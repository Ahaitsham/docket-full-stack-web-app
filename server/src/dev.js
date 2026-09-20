// Local development / traditional hosting entry point.
import 'dotenv/config';
import app from './app.js';

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Docket API running on http://localhost:${port}`));
