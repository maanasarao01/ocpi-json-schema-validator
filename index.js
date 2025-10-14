//* schema used from -> https://github.com/Llocer/llocer_ocpi_json/
const express = require('express');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const allowedSchemas = require('./config/allowedObjects');

const SCHEMAS_DIR = path.join(__dirname, 'schemas');
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize AJV
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Load schemas from directory
function loadSchemas() {
  // Include all files, even those without extensions
  const files = fs.readdirSync(SCHEMAS_DIR);

  for (const file of files) {
    const fullPath = path.join(SCHEMAS_DIR, file);

    const content = fs.readFileSync(fullPath, 'utf8').trim();

    try {
      const schema = JSON.parse(content);
      const name = file; // use filename directly as schema id

      // Set schema ID so AJV can resolve $ref like "$ref": "evse#"
      schema.$id = schema.$id || name;

      ajv.addSchema(schema, name);
      console.log(`✅ Loaded schema: ${name}`);
    } catch (err) {
      console.error(`❌ Failed to parse schema file: ${file} — ${err.message}`);
    }
  }
}

loadSchemas();

// UI route
app.get('/', (req, res) => {
  res.render('index', { schemas: allowedSchemas, result: null });
});

app.post('/validate', (req, res) => {
  const schemaName = req.body.schema;
  const validator = ajv.getSchema(schemaName);

  if (!validator) {
    return res.render('index', {
      schemas: allowedSchemas,
      result: { valid: false, errors: [`Unknown schema '${schemaName}'`] },
    });
  }

  let payload = req.body;
   try {
    payload = JSON.parse(req.body.jsonInput);
  } catch (err) {
    console.error('❌ JSON parse error:', err.message);
    return res.render('index', {
      schemas: allowedSchemas,
      result: { valid: false, errors: [{
        'schemaPath': 'Invalid JSON format',
        'message': err.message}] },
    });
  }

   const valid = validator(payload);
   const errors = valid ? null : validator.errors;
   console.log(errors);

  res.render('index', {
    schemas: allowedSchemas,
    result: { valid, errors },
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 OCPI schema validator running at http://localhost:${PORT}`);
});
