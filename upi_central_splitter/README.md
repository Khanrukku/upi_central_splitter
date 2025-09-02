Centralized UPI Splitter - Prototype
===================================

This prototype demonstrates the flow:
1. Initiator creates a bill after scanning merchant QR and enters participants (first is initiator/collector).
2. App generates per-person UPI deeplinks that pay the **initiator** (collector).
3. Participants click deeplink (mobile) or scan QR (desktop) to pay their share to the collector.
4. Participants mark 'I've Paid' to confirm (or in production this would be auto-confirmed via PSP webhooks).
5. Once total collected >= bill total, the initiator can click 'Pay Restaurant' to make a single payment to the merchant.

Run locally:
- Backend:
  cd backend
  python -m venv venv
  source venv/bin/activate   # Windows: venv\Scripts\activate
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000

- Frontend:
  cd frontend
  npm install
  npm run dev
  open http://localhost:5173

Notes:
- This prototype uses in-memory storage; restart clears state. For production use a database.
- Deeplinks open UPI apps on mobile. Desktop users should scan QR codes.
- To make this production-ready: add PSP webhook reconciliation, authentication, persistence, and rate-limiting.
