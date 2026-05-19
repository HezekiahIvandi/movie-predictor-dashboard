1. source venv/Scripts/activate
2. cd backend
3. uvicorn app:app --host 0.0.0.0 --port 8000
4. ngrok config add-authtoken 3CuhxwMIuOYhETkneDRtJY5wu1q_59RFvhqPneN5gBNq9YsjF
   - Authtoken saved to configuration file: C:\Users\User\AppData\Local/ngrok/ngrok.yml
5. ngrok http 8000
