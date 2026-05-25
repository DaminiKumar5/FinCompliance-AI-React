import streamlit as st
import json
import os
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

# Set up Gemini AI client
# You will set this environment variable in Streamlit Community Cloud
api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

st.set_page_config(page_title="FinCompliance", layout="wide")
st.title("⚖️ FinCompliance: Multi-Agent Corporate Auditor")
st.markdown("Automated cross-referencing of corporate ledgers against regional tax codes.")

# --- Pydantic Schemas (Enforcing strict data contracts) ---
class Transaction(BaseModel):
    id: str
    amount: float
    currency: str
    category: str
    location: str
    description: str

class Ledger(BaseModel):
    transactions: list[Transaction]

class TaxRules(BaseModel):
    region: str
    corporate_tax_rate: float
    exemptions: list[str]
    flaggable_categories: list[str]
    context_rules: str

class FlaggedTransaction(BaseModel):
    transaction_id: str
    reason: str
    severity: str = Field(description="Low, Medium, or High")

class AuditReport(BaseModel):
    flagged_transactions: list[FlaggedTransaction]
    summary: str
    overall_risk_score: float = Field(description="Score from 1 to 100")
    recommendations: list[str]

# --- UI Inputs ---
with st.sidebar:
    st.header("Configuration")
    region = st.text_input("Tax Jurisdiction", value="India")

st.subheader("1. Input Data")

uploaded_file = st.file_uploader("Upload CSV or Text File with Ledger Data", type=["csv", "txt"])
default_text = "TXN-IND-2023012, 4500000 INR, Client Entertainment, Macau, SAR, Executive casino resort client meeting\nTXN-IND-2023088, 850000 INR, Corporate Gifts, New Delhi, Gold coins purchase for Diwali partner gifts"

if uploaded_file is not None:
    # Read the file and decode to string
    raw_text = uploaded_file.getvalue().decode("utf-8")
else:
    raw_text = default_text

raw_data = st.text_area(
    "Raw Ledger Data", 
    value=raw_text, 
    height=150
)

if st.button("Run AI Audit", type="primary"):
    if not raw_data:
        st.warning("Please enter some ledger data.")
    else:
        st.subheader("2. Agent Workflow")
        
        # --- AGENT 1: Ledger Ingestion ---
        with st.status("Agent 1: Ledger Ingestion Agent processing...", expanded=True) as status1:
            st.write("Extracting structured Pydantic models from unstructured raw string...")
            prompt1 = f"Extract the transactions from the following raw ledger log:\n\n{raw_data}"
            
            response1 = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt1,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=Ledger,
                    temperature=0.1
                )
            )
            parsed_ledger = response1.text
            st.json(parsed_ledger) # Visualizing the data pass
            status1.update(label="Agent 1: Ledger Parsed", state="complete")

        # --- AGENT 2: Tax Code Expert ---
        with st.status("Agent 2: Tax Code Expert consulting laws...", expanded=True) as status2:
            st.write(f"Generating tax rules and risk factors for {region}...")
            prompt2 = f"Provide the current or recent generic corporate tax guidelines and audit risk factors for businesses operating in {region}. Focus on what write-offs are flaggable and standard exemptions."
            
            response2 = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt2,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=TaxRules,
                    temperature=0.2
                )
            )
            tax_rules = response2.text
            st.json(tax_rules) # Visualizing the rules
            status2.update(label="Agent 2: Tax Rules Generated", state="complete")

        # --- AGENT 3: Auditor Agent ---
        with st.status("Agent 3: Auditor Agent searching for variances...", expanded=True) as status3:
            st.write("Cross-referencing ledger against tax rules...")
            prompt3 = f"""You are the Auditor Agent.
            Analyze the following Ledger Data against the Tax Code Rules.
            
            Ledger Data:
            {parsed_ledger}
            
            Tax Code Rules:
            {tax_rules}
            
            Highlight high-risk line items and generate an audit variance report."""
            
            response3 = client.models.generate_content(
                model='gemini-2.5-pro',
                contents=prompt3,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=AuditReport,
                    temperature=0.1
                )
            )
            audit_report = response3.text
            report_dict = json.loads(audit_report)
            status3.update(label="Agent 3: Audit Complete", state="complete")

        # --- FINAL OUTPUT ---
        st.subheader("3. Final Audit Variance Report")
        
        st.metric("Overall Risk Score", f"{report_dict.get('overall_risk_score')}/100")
        st.info(report_dict.get('summary'))
        
        st.write("### Flagged Transactions")
        for flag in report_dict.get('flagged_transactions', []):
            if flag['severity'].lower() == 'high':
                st.error(f"**{flag['transaction_id']}** (High Risk): {flag['reason']}")
            elif flag['severity'].lower() == 'medium':
                st.warning(f"**{flag['transaction_id']}** (Medium Risk): {flag['reason']}")
            else:
                st.info(f"**{flag['transaction_id']}** (Low Risk): {flag['reason']}")
                
        st.write("### Recommendations")
        for rec in report_dict.get('recommendations', []):
            st.write(f"- {rec}")
