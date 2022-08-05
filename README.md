# Keep to PDF

Quick script I wrote to convert Keep notes (exported from Takeout) into PDFs.

## Installation

`npm install`

## Usage

1. Download your Keep notes from Takeout
2. Place the JSON files into `keep/`
3. Run `npm run process` (or `node index.js`)
4. Resulting PDFs will be placed into `generated/`

It will keep track of notes already processed in `processed.txt`, so if you re-ran the script, it would skip those files.
