export function generateIndianSample(): string {
  const cities = ["Mumbai, MH", "Bengaluru, KA", "New Delhi, DL", "Hyderabad, TS", "Chennai, TN", "Pune, MH", "Gurugram, HR", "Kolkata, WB", "Ahmedabad, GJ"];
  const categories = [
    "Office Rent", "IT Equipment", "Software Licenses", "Contractor Salary",
    "Client Entertainment", "Travel & Logistics", "Legal Consultation",
    "Marketing Campaign", "Office Supplies", "Server Hosting", "Pantry Expenses",
    "Consulting Services", "Vehicle Maintenance", "Corporate Gifts"
  ];

  const data: string[] = [];
  data.push("ID,Amount,Category,Location,Description");
  
  for (let i = 1; i <= 100; i++) {
    const id = `TXN-IND-${2023000 + i}`;
    let category = categories[Math.floor(Math.random() * categories.length)];
    let city = cities[Math.floor(Math.random() * cities.length)];
    // Base amount between 5k and 500k
    let amount = Math.floor(Math.random() * 500000) + 5000;
    
    let desc = `Routine ${category.toLowerCase()} payment processing`;

    // Inject intentional audit variances / high-risk items for the LLM to catch
    if (i === 12) {
      category = "Client Entertainment"; 
      city = "Macau, SAR"; 
      amount = 4500000; 
      desc = "Executive casino resort client meeting & hospitality";
    } else if (i === 45) {
      category = "Offshore Consulting"; 
      city = "Mauritius"; 
      amount = 12500000; 
      desc = "Tax optimization advisory fee shell comp";
    } else if (i === 88) {
      category = "Corporate Gifts"; 
      city = "New Delhi, DL"; 
      amount = 850000; 
      desc = "Gold coins purchase for Diwali partner gifts";
    } else if (i === 73) {
      category = "Penalties";
      city = "Mumbai, MH";
      amount = 250000;
      desc = "Late tax filing penalty payment to government";
    }

    data.push(`${id},${amount} INR,${category},"${city}","${desc}"`);
  }
  
  return data.join("\n");
}
