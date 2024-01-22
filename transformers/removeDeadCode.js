const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

function removeDeadCode(ast) {
    let functions = [];
    let varname = false;
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
                            functions.push(
                                path.node.id.name
                            )
                            path.remove()
                        }
                    },
                    VariableDeclaration(path) {
                        if (
                            !varname &&
                            t.isArrayExpression(path.node.declarations[0].init)
                        ) {
                            varname = path.node.declarations[0].id.name
                            path.remove()
                        }
                    }
                });
            } else if (
                path.node.key.value === 3
            ) {
                let functionsCode = path.node.value.elements[0].body.body;
                let functionCodeAST = t.file(t.program(functionsCode));
                traverse(functionCodeAST, {
                    FunctionDeclaration(path) {
                        if (functions.includes(path.node.id.name)) {
                            path.remove()
                        }
                    },
                    VariableDeclaration(path) {
                        if (
                            path.node.declarations[0].id.name === varname
                        ) {
                            path.remove()
                        }
                    }
                });
            }
        }
    })
}

module.exports = removeDeadCode;