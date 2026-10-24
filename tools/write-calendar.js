import {writeFile} from 'node:fs/promises';
import {CONFIG} from '../config.js';
import {createIcs} from '../lib.js';
await writeFile(new URL('../shivani-baby-shower.ics', import.meta.url), createIcs(CONFIG));
console.log('Updated shivani-baby-shower.ics from config.js');
