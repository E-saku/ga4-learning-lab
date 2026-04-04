const fs = require('fs');
const path = require('path');

const generateCSV = () => {
  const lines = ['Date,Event name,Active users,Event count'];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    
    // Active users: 50 + random(0-100)
    const activeUsers = Math.floor(Math.random() * 100) + 50;
    
    // session_start: Active users * 1.5
    const sessions = Math.floor(activeUsers * 1.5 + Math.random() * 20);
    lines.push(`${dateStr},session_start,${activeUsers},${sessions}`);
    
    // lookup_term: sessions * 0.4 (Engagement point)
    const lookups = Math.floor(sessions * 0.4 + Math.random() * 10);
    lines.push(`${dateStr},lookup_term,${activeUsers},${lookups}`);
    
    // page_view: sessions * 2.2
    const views = Math.floor(sessions * 2.2 + Math.random() * 30);
    lines.push(`${dateStr},page_view,${activeUsers},${views}`);
  }
  
  const csvContent = lines.join('\n');
  fs.writeFileSync(path.join(__dirname, 'dummy_data.csv'), csvContent);
  console.log('dummy_data.csv generated successfully.');
};

generateCSV();
