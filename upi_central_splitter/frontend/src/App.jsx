import React, {useState} from 'react'
import QRCode from "react-qr-code";


export default function App(){
  const [merchant, setMerchant] = useState('Restaurant')
  const [merchantVpa, setMerchantVpa] = useState('restaurant@upi')
  const [total, setTotal] = useState('')
  const [rows, setRows] = useState([{name:'You', vpa:''},{name:'Friend1', vpa:''}])
  const [bill, setBill] = useState(null)
  const [error, setError] = useState(null)

  const updateRow=(i,f,v)=>{ const c=[...rows]; c[i][f]=v; setRows(c); }
  const addRow=()=>setRows([...rows,{name:'',vpa:''}])
  const removeRow=(i)=>setRows(rows.filter((_,idx)=>idx!==i))

  const createBill = async ()=>{
    setError(null); setBill(null)
    if(!total || rows.length===0) { setError('Enter amount and participants'); return }
    const payload = { merchant_name: merchant, merchant_vpa: merchantVpa, total_amount: parseFloat(total), initiator: rows[0], participants: rows }
    const res = await fetch('http://127.0.0.1:8000/api/create-bill', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    const data = await res.json()
    if(res.status!==200){ setError(JSON.stringify(data)); return }
    setBill(data)
  }

  const confirmPayment = async (name)=>{
    const payload = { bill_id: bill.bill_id, payer_name: name, reference: '' }
    const res = await fetch('http://127.0.0.1:8000/api/confirm-payment', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
    const data = await res.json()
    if(res.status!==200){ setError(JSON.stringify(data)); return }
    // refresh bill
    const bres = await fetch('http://127.0.0.1:8000/api/bill/' + bill.bill_id)
    const bdata = await bres.json()
    setBill(bdata)
  }

  const payMerchant = async ()=>{
    const res = await fetch('http://127.0.0.1:8000/api/pay-merchant/' + bill.bill_id, { method:'POST' })
    const data = await res.json()
    if(res.status!==200){ setError(JSON.stringify(data)); return }
    setBill(await (await fetch('http://127.0.0.1:8000/api/bill/' + bill.bill_id)).json())
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">Centralized UPI Splitter — Prototype</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm">Merchant name</label>
            <input value={merchant} onChange={e=>setMerchant(e.target.value)} className="border p-2 rounded w-full"/>
            <label className="block text-sm mt-2">Merchant VPA (optional)</label>
            <input value={merchantVpa} onChange={e=>setMerchantVpa(e.target.value)} className="border p-2 rounded w-full"/>
            <label className="block text-sm mt-2">Total amount (₹)</label>
            <input value={total} onChange={e=>setTotal(e.target.value)} className="border p-2 rounded w-full"/>
          </div>
          <div>
            <h3 className="font-medium">Participants (first is initiator/collector)</h3>
            {rows.map((r,i)=> (
              <div key={i} className="flex gap-2 items-center mt-2">
                <input value={r.name} onChange={e=>updateRow(i,'name',e.target.value)} placeholder="Name" className="p-2 border rounded w-36"/>
                <input value={r.vpa} onChange={e=>updateRow(i,'vpa',e.target.value)} placeholder="VPA (alice@upi)" className="p-2 border rounded w-48"/>
                <button onClick={()=>removeRow(i)} className="px-2 py-1 bg-red-500 text-white rounded">X</button>
              </div>
            ))}
            <div className="mt-2"><button onClick={addRow} className="px-3 py-1 bg-blue-600 text-white rounded">Add Participant</button></div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={createBill} className="px-4 py-2 bg-green-600 text-white rounded">Create Bill & Generate Links</button>
        </div>

        {error && <div className="mt-3 text-red-600">{error}</div>}

        {bill && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold">Bill ID: {bill.bill_id}</h2>
            <div className="mt-2">Merchant: {bill.merchant_name} (collected ₹{(bill.collected_paise/100).toFixed(2)} / ₹{bill.total_amount})</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {Object.entries(bill.participants).map(([name, info])=> (
                <div key={name} className="p-3 border rounded bg-slate-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{name}</div>
                      <div className="text-sm">Amount: ₹{info.amount.toFixed(2)}</div>
                      <div className="text-xs text-slate-600">VPA: {info.vpa || 'Not provided'}</div>
                      <div className="text-xs text-slate-600">Paid: {info.paid ? 'Yes' : 'No'}</div>
                    </div>
                    <div>
                      {info.deeplink ? (
                        <a href={info.deeplink} className="px-3 py-2 bg-blue-600 text-white rounded inline-block">Pay via UPI</a>
                      ) : (
                        <div className="text-xs">No VPA — scan QR of collector</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs mb-1">QR (scan with phone if on desktop)</div>
                    <div className="bg-white p-2 inline-block rounded">
                      <QRCode value={info.deeplink ? info.deeplink : `${bill.initiator.name}@collector | ₹${info.amount.toFixed(2)}`} size={128} />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {!info.paid && <button onClick={()=>confirmPayment(name)} className="px-3 py-1 bg-emerald-600 text-white rounded">I've Paid (mark)</button>}
                    {info.paid && <div className="text-xs text-slate-600">Paid (ref: {info.reference || '—'})</div>}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <button onClick={payMerchant} className="px-4 py-2 bg-indigo-600 text-white rounded">Pay Restaurant (simulate)</button>
              <div className="text-sm mt-2">Note: Pay Restaurant will succeed only after full collection.</div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
