const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Server running in production/development mode`);
  console.log(`   Local URL: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
