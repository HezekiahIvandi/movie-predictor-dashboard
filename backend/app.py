from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import torch
import numpy as np
import pandas as pd
import xgboost as xgb
import joblib
from transformers import AutoTokenizer, AutoModel
from fastapi.middleware.cors import CORSMiddleware

# CONFIG
MODEL_PATH = "movie_rating_predictor_23_03_2026.pkl"
BERT_MODEL_NAME = "indolem/indobertweet-base-uncased"
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# LOAD MODELS
print("Loading XGBoost model...")
loaded_bundle = joblib.load(MODEL_PATH)
xgb_model = loaded_bundle["model"]

print("Loading IndoBERTweet model...")
tokenizer = AutoTokenizer.from_pretrained(BERT_MODEL_NAME)
bert_model = AutoModel.from_pretrained(BERT_MODEL_NAME).to(device)
bert_model.eval()

print("Models loaded successfully!")

# FASTAPI SETUP
app = FastAPI(title="Movie Rating Predictor API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://movie-predictor-dashboard.vercel.app"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# UTILS
def mean_pooling(model_output, attention_mask):
    token_embeddings = model_output.last_hidden_state
    mask = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    summed = torch.sum(token_embeddings * mask, 1)
    counts = torch.clamp(mask.sum(1), min=1e-9)
    return summed / counts


def get_embeddings(texts, batch_size=32, max_length=128):
    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        inputs = tokenizer(
            batch,
            padding=True,
            truncation=True,
            max_length=max_length,
            return_tensors="pt",
        ).to(device)

        with torch.no_grad():
            outputs = bert_model(**inputs)
            embeddings = mean_pooling(outputs, inputs["attention_mask"])

        all_embeddings.append(embeddings.cpu().numpy())

    return np.vstack(all_embeddings)

# REQUEST / RESPONSE SCHEMAS
class CommentItem(BaseModel):
    movie_id: str
    comment_text: str
    imdb_rating: Optional[float] = None

class PredictRequest(BaseModel):
    data: List[CommentItem]

# API ENDPOINT
@app.post("/predict")
def predict(req: PredictRequest):
    if not req.data:
        raise HTTPException(status_code=400, detail="No data provided.")

    df = pd.DataFrame([item.dict() for item in req.data])
    print(f"🔹 Received {len(df)} rows for prediction")

    # Generate embeddings
    texts = df["comment_text"].fillna("").astype(str).tolist()
    embeddings = get_embeddings(texts)

    # Predict
    preds = xgb_model.predict(embeddings)

    # Replace invalid numbers
    preds = np.nan_to_num(preds, nan=0.0, posinf=10.0, neginf=0.0)
    df["predicted_rating"] = preds

    #Rename column
    df = df.rename(columns={"imdb_rating": "actual_rating"})
    
    # Replace remaining invalid JSON values
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
    df = df.astype({"predicted_rating": float})
    result = df.to_dict(orient="records")

    return result


# HEALTH CHECK
@app.get("/")
def root():
    return {"message": "hello world!"}
