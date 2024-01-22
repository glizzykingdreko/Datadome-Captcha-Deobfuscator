const fs = require('fs');
const parser = require('@babel/parser');
const generate = require('@babel/generator').default;

const reorderSwitchCases = require('./transformers/reorderSwitchCase');
const removeDeadCode = require('./transformers/removeDeadCode');
const {
    deobfuscateFirstType, 
    deobfuscateSecondType, 
    cleanStrings
} = require('./transformers/deobfuscateStrings');

function decodeHex(content) { 
    const pattern = /'(\\x[0-9a-fA-F]+)+'/g;
    let matches = content.match(pattern) || [];
    let decodedStrings = matches.map(match => {
        let hexValues = match.slice(1, -1).replace(/\\x/g, '').match(/.{1,2}/g);
        return hexValues.map(hex => String.fromCharCode(parseInt(hex, 16))).join('');
    });
    for (let i = 0; i < matches.length; i++) {
        content = content.replace(matches[i], "`" + decodedStrings[i] + "`");
    }
    return content;
}

function deobfuscateCode(inputFile, outputFile) {
    console.log("-=-=-=-=-=-=-=-=-=-=-=-=-=-=- Datadome Captcha Deobfuscator -=-=-=-=-=-=-=-=-=-=-=-=-=-=-")
    const code = fs.readFileSync(inputFile, 'utf-8');
    const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
    });
    console.log(`=-=-=-=-=-=-=-=-=-=-> Deobfuscating ${inputFile}...`);
    console.log(`=-=-=-=-=-=-> Deobfuscated ${deobfuscateFirstType(ast)} matches from the first type of encryption`); 
    console.log(`=-=-=-=-=-=-> Deobfuscated ${deobfuscateSecondType(ast)} matches from the second type of encryption`);
    reorderSwitchCases(ast);
    console.log(`=-=-=-=-=-=-> Reordered case switch`);
    removeDeadCode(ast);
    console.log(`=-=-=-=-=-=-> Removed dead code`);
    cleanStrings(ast);
    console.log(`=-=-=-=-=-=-> Cleaned strings`);
    fs.writeFileSync(outputFile, decodeHex(generate(ast).code));
    console.log(`=-=-=-=-=-=-> Saved to ${outputFile}`);
    console.log(`=-=-=-=-=-=-=-=-=-=-> Done!`);
    console.log("-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-")
}

deobfuscateCode(
    process.argv[2] || 'script.js',
    process.argv[3] || 'output.js'
)