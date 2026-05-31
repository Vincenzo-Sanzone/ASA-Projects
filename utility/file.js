import fs from 'fs';
import path from 'path';

/**
 * Reads a file asynchronously.
 * @param {string} filePath - The path to the file to read.
 * @returns {Promise<string>} A promise resolving to the file content.
 */
function readFile ( filePath ) {    
    return new Promise( (res, rej) => {
        fs.readFile( filePath, 'utf8', (err, data) => {
            if (err) rej(err)
            else res(data)
        })
    })
}

function saveFile( filePath, content ){
    return new Promise( (res, rej) => {
        fs.writeFile( filePath, content, (err) => {
            if (err) rej(err)
            else res(true)
        })
    })
}

export { readFile, saveFile };