
const vm = require('vm');
const generate = require('@babel/generator').default;
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const deobfuscateFirstType = (ast) => {
    let context = vm.createContext({});
    let replacements = 0;
    traverse(ast, {
        ObjectProperty(path) {
            if (
                path.node.key.value === 1
            ) {
                let functionsCode = path.node.value.elements[0].body.body;
                let functionCodeAST = t.file(t.program(functionsCode));
                traverse(functionCodeAST, {
                    FunctionDeclaration(path) {
                        if (path.node.params.length === 2 || path.node.params.length === 1) {
                            vm.runInContext(generate(path.node).code, context);
                        }
                    },
                });
                path.stop()
            }
        }
    })
    for (let i = 0; i < 5; i++) {
        traverse(ast, {
            CallExpression(path) {
                if (
                    // if the function is called with 2 arguments and is inside our context
                    path.node.arguments.length === 2 &&
                    // Check if both arguments are numbers
                    path.node.arguments[0].type === 'NumericLiteral' &&
                    path.node.arguments[1].type === 'NumericLiteral' &&
                    path.node.callee.name in context
                ) {
                    let code = generate(path.node).code;
                    let result = vm.runInContext(code, context);
                    
                    // if the result is a string
                    if (typeof result === 'string') {
                        // replace the call expression with the result
                        path.replaceWith(t.stringLiteral(result));
                    } else {
                        path.replaceWith(t.numericLiteral(result));
                    }
                    replacements++;
                }
            }
        });
    }
    return replacements;
}

const deobfuscateSecondType = (ast) => {
    let context = vm.createContext({});
    let functionName;
    let found = false;
    let replacements = 0;
    traverse(ast, {
        ObjectProperty(path) {
            if (
                path.node.key.value === 3
            ) {
                let functionsCode = path.node.value.elements[0].body.body;
                let functionCodeAST = t.file(t.program(functionsCode));
                traverse(functionCodeAST, {
                    VariableDeclaration(path) {
                        if (
                            !found &&
                            t.isArrayExpression(path.node.declarations[0].init)
                        ) {
                            let name = path.node.declarations[0].id.name
                            found = {name, code: generate(path.node).code};
                        }
                    }
                });
                traverse(functionCodeAST, {
                    FunctionDeclaration(path) {
                        if (
                            t.isVariableDeclaration(path.node.body.body[0]) &&
                            t.isMemberExpression(path.node.body.body[0].declarations[0].init) &&
                            t.isIdentifier(path.node.body.body[0].declarations[0].init.object) &&
                            found.name === path.node.body.body[0].declarations[0].init.object.name
                        ) {
                            functionName = path.node.id.name;
                            vm.runInContext(generate(path.node).code, context);
                        } else if (
                            t.isReturnStatement(path.node.body.body[0]) &&
                            t.isCallExpression(path.node.body.body[0].argument) &&
                            t.isMemberExpression(path.node.body.body[0].argument.callee)
                        ) {
                            vm.runInContext(generate(path.node).code, context);
                        }
                    },
                });
                vm.runInContext(
                    found.code, 
                    context
                );
                path.stop()
            }
        }
    })
    traverse(ast, {
        CallExpression(path) {
            if (
                path.node.callee.name === functionName
            ) {
                try{
                    let code = generate(path.node).code;
                    let result = vm.runInContext(code, context);
                    // if the result is a string
                    if (typeof result === 'string') {
                        // replace the call expression with the result
                        path.replaceWith(t.stringLiteral(result)); 
                    } else {
                        path.replaceWith(t.numericLiteral(result));
                    }
                    replacements++;
                } catch(e) {
                }
            }
        },
    });
    return replacements;
}

const cleanStrings = (ast) => {
    traverse(ast, {
        BinaryExpression(path) {
            if (path.node.operator === '+') {
                const mergedExpr = mergeStringLiterals(path.node);
                if (t.isStringLiteral(mergedExpr)) {
                    path.replaceWith(mergedExpr);
                }
            }
        }
    })

    traverse(ast, {
        MemberExpression(path) {
            if (t.isStringLiteral(path.node.property) && /^[a-zA-Z$_][a-zA-Z$_0-9]*$/.test(path.node.property.value)) {
                const identifier = t.identifier(path.node.property.value);
                path.node.property = identifier;
                path.node.computed = false;
            }
        }
    })

    traverse(ast, {
        MemberExpression(path) {
            // Check if the property access is using bracket notation with a string literal
            if (
                path.node.computed &&
                t.isArrayExpression(path.node.property) &&
                t.isStringLiteral(path.node.property.elements[0])
            ) {
                let realcode = path.node.property.elements[0].extra.rawValue;
                path.node.property = t.identifier(realcode);
                path.node.computed = false;
            }
        }
    })
}

function mergeStringLiterals(expr) {
    if (t.isBinaryExpression(expr, { operator: '+' })) {
        const left = mergeStringLiterals(expr.left);
        const right = mergeStringLiterals(expr.right);
        if (t.isStringLiteral(left) && t.isStringLiteral(right)) {
            return t.stringLiteral(left.value + right.value);
        }
        return t.binaryExpression('+', left, right);
    }
    return expr;
}

module.exports = {deobfuscateFirstType, deobfuscateSecondType, cleanStrings};