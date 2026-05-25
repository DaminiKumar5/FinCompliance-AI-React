import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // SSE endpoint for the audit process
  app.post("/api/audit", async (req, res) => {
    // Setup standard fetch-friendly streaming
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");
    
    const sendEvent = (event: any) => {
      res.write(JSON.stringify(event) + "\n");
    };

    const { rawLedgerText, region } = req.body;

    try {
      sendEvent({ type: "log", message: "Agent 1: The Ledger Ingestion Agent starting... Processing raw ledger." });

      // AGENT 1: Ledger Ingestion Agent
      const ledgerSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique transaction ID" },
            amount: { type: Type.NUMBER, description: "Transaction amount" },
            currency: { type: Type.STRING, description: "3-letter currency code (e.g., USD, INR)", nullable: true },
            category: { type: Type.STRING, description: "Expense/Revenue category" },
            location: { type: Type.STRING, description: "Geographic location" },
            description: { type: Type.STRING, description: "Description of the transaction" },
          },
          required: ["id", "amount", "category", "location", "description"],
        },
      };

      const ledgerResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Extract the transactions from the following raw ledger log:\n\n${rawLedgerText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: ledgerSchema,
          temperature: 0.1,
        },
      });

      const parsedLedger = JSON.parse(ledgerResponse.text || "[]");
      sendEvent({ type: "ledger_data", data: parsedLedger });
      sendEvent({ type: "log", message: "Agent 1: Ledger processing complete. Handoff to Agent 2." });

      // AGENT 2: Tax Code Expert
      sendEvent({ type: "log", message: `Agent 2: The Tax Code Expert retrieving tax laws for region: ${region}...` });

      const taxSchema = {
        type: Type.OBJECT,
        properties: {
          region: { type: Type.STRING },
          corporateTaxRate: { type: Type.NUMBER },
          exemptions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          flaggableCategories: {
            type: Type.ARRAY,
            items: { type: Type.STRING, description: "Categories that commonly trigger audits or are non-deductible." }
          },
          contextRules: { type: Type.STRING, description: "Detailed summary of laws to watch out for." }
        },
        required: ["region", "corporateTaxRate", "exemptions", "flaggableCategories", "contextRules"]
      };

      const taxResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Provide the current or recent generic corporate tax guidelines and audit risk factors for businesses operating in ${region}. Focus on what write-offs are flaggable and standard exemptions.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: taxSchema,
          temperature: 0.2,
        },
      });

      const taxRules = JSON.parse(taxResponse.text || "{}");
      sendEvent({ type: "tax_data", data: taxRules });
      sendEvent({ type: "log", message: "Agent 2: Tax laws context generated. Handoff to Agent 3." });

      // AGENT 3: Auditor Agent
      sendEvent({ type: "log", message: "Agent 3: The Auditor Agent is cross-referencing ledger against tax codes..." });

      const auditSchema = {
        type: Type.OBJECT,
        properties: {
          flaggedTransactions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                transactionId: { type: Type.STRING },
                reason: { type: Type.STRING },
                severity: { type: Type.STRING, description: "Low, Medium, or High" }
              },
              required: ["transactionId", "reason", "severity"]
            }
          },
          summary: { type: Type.STRING },
          overallRiskScore: { type: Type.NUMBER, description: "Score from 1 to 100" },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["flaggedTransactions", "summary", "overallRiskScore", "recommendations"]
      };

      const auditResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are the Auditor Agent.
        Analyze the following Ledger Data against the Tax Code Rules.
        
        Ledger Data:
        ${JSON.stringify(parsedLedger, null, 2)}
        
        Tax Code Rules:
        ${JSON.stringify(taxRules, null, 2)}
        
        Highlight high-risk line items and generate an audit variance report.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: auditSchema,
          temperature: 0.1,
        },
      });

      const auditReport = JSON.parse(auditResponse.text || "{}");
      sendEvent({ type: "report_data", data: auditReport });
      sendEvent({ type: "log", message: "Agent 3: Audit complete." });

      sendEvent({ type: "complete" });
      res.end();
    } catch (error: any) {
      console.error(error);
      sendEvent({ type: "error", message: error.message });
      res.end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
