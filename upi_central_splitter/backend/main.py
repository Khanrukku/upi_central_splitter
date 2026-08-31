
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from urllib.parse import urlencode
import uuid, time

app = FastAPI(title="UPI Centralized Splitter (Prototype)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for demo. In production, use a database.
BILLS: Dict[str, dict] = {}

class Person(BaseModel):
    name: str
    vpa: Optional[str] = None  # optional VPA (alice@upi)

class CreateBillRequest(BaseModel):
    merchant_name: str
    merchant_vpa: Optional[str] = None
    total_amount: float
    initiator: Person
    participants: List[Person]  # includes initiator optionally

class ConfirmPaymentRequest(BaseModel):
    bill_id: str
    payer_name: str
    reference: Optional[str] = None  # UPI transaction reference if any

def make_upi_link(vpa: str, name: str, amount: float, note: str='') -> str:
    q = {"pa": vpa, "pn": name, "am": f"{amount:.2f}", "cu": "INR", "tn": note[:80]}
    return "upi://pay?" + urlencode(q)

@app.post('/api/create-bill')
def create_bill(req: CreateBillRequest):
    # Create bill id
    bill_id = str(uuid.uuid4())
    total_paise = int(round(req.total_amount * 100))
    n = len(req.participants)
    if n == 0:
        raise HTTPException(status_code=400, detail='No participants')
    base = total_paise // n
    rem = total_paise % n
    # deterministic distribution
    parts_sorted = [p.name for p in req.participants]
    shares_paise = {p.name: base for p in req.participants}
    for p in sorted(parts_sorted)[:rem]:
        shares_paise[p] += 1
    # build participant entries
    participants = {}
    note = f"Split for {req.merchant_name} - Bill {bill_id[:8]}"
    for p in req.participants:
        amt_paise = shares_paise[p.name]
        amt = amt_paise / 100.0
        deeplink = None
        if p.vpa:
            # payment directed to initiator's VPA (so initiator collects)
            payee_vpa = req.initiator.vpa if req.initiator.vpa else req.initiator.name + "@upi"
            deeplink = make_upi_link(payee_vpa, req.initiator.name, amt, note=note)
        participants[p.name] = {
            'name': p.name,
            'vpa': p.vpa,
            'amount': amt,
            'amount_paise': amt_paise,
            'paid': False,
            'paid_at': None,
            'reference': None,
            'deeplink': deeplink
        }
    BILLS[bill_id] = {
        'id': bill_id,
        'merchant_name': req.merchant_name,
        'merchant_vpa': req.merchant_vpa,
        'total_amount': req.total_amount,
        'total_paise': total_paise,
        'initiator': {'name': req.initiator.name, 'vpa': req.initiator.vpa},
        'participants': participants,
        'created_at': int(time.time()),
        'collected_paise': 0,
        'paid_to_merchant': False
    }
    return {'bill_id': bill_id, 'note': note, 'shares': shares_paise, 'participants': participants}

@app.post('/api/confirm-payment')
def confirm_payment(req: ConfirmPaymentRequest):
    bill = BILLS.get(req.bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    p = bill['participants'].get(req.payer_name)
    if not p:
        raise HTTPException(status_code=404, detail='Participant not found')
    if p['paid']:
        return {'ok': True, 'message': 'Already marked paid'}
    p['paid'] = True
    p['paid_at'] = int(time.time())
    p['reference'] = req.reference
    bill['collected_paise'] += p['amount_paise']
    return {'ok': True, 'collected_paise': bill['collected_paise'], 'total_paise': bill['total_paise']}

@app.get('/api/bill/{bill_id}')
def get_bill(bill_id: str):
    bill = BILLS.get(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    # compute status
    bill_copy = dict(bill)
    bill_copy['collected_amount'] = bill['collected_paise'] / 100.0
    bill_copy['remaining_paise'] = max(0, bill['total_paise'] - bill['collected_paise'])
    bill_copy['remaining_amount'] = bill_copy['remaining_paise'] / 100.0
    return bill_copy

@app.post('/api/pay-merchant/{bill_id}')
def pay_merchant(bill_id: str):
    bill = BILLS.get(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    if bill['paid_to_merchant']:
        return {'ok': True, 'message': 'Already paid to merchant'}
    if bill['collected_paise'] < bill['total_paise']:
        raise HTTPException(status_code=400, detail='Not enough collected to pay merchant')
    # Simulate merchant payment: in production you'd trigger UPI pay flow from initiator to merchant
    bill['paid_to_merchant'] = True
    bill['paid_to_merchant_at'] = int(time.time())
    return {'ok': True, 'message': 'Paid to merchant (simulated)'}
