const generate = require('@babel/generator').default;
const t = require('@babel/types');
const traverse = require('@babel/traverse').default;

function reorderSwitchCases(ast) {
    let matches = 0;
    traverse(ast, {
        ForStatement(path) {
            if (
                path.node.body.body &&
                t.isSwitchStatement(path.node.body.body[0]) &&
                t.isVariableDeclaration(path.node.init) || t.isAssignmentExpression(path.node.init)
            ) {
                let switchVar, startCase;
                try {
                    switchVar = path.node.init.declarations[
                        path.node.init.declarations.length - 1
                    ].id.name;
                    startCase = path.node.init.declarations[
                        path.node.init.declarations.length - 1
                    ].init.value;
                } catch (e) {
                    switchVar = path.node.init.left.name;
                    startCase = path.node.init.right.value;
                }
                let switchStatement;
                try { switchStatement = path.node.body.body[0]; } catch (e) { return; }
                let initialCase;
                const cases = {};
                // Map cases by their test value
                switchStatement.cases.forEach(caseNode => {
                    if (t.isNumericLiteral(caseNode.test)) {
                        // We need to remove 'continue' statements from the case
                        caseNode.consequent = caseNode.consequent.filter(
                            node => !t.isContinueStatement(node)
                        );
                        // We could have the 'continue' inside an if 
                        caseNode.consequent.forEach((node, index, arr) => {
                            if (t.isIfStatement(node)) {
                                // Handle the consequent block of the IfStatement
                                if (t.isBlockStatement(node.consequent)) {
                                    node.consequent.body = node.consequent.body.filter(
                                        innerNode => !t.isContinueStatement(innerNode)
                                    );
                                } else {
                                    // If the consequent is not a BlockStatement (i.e., a single statement), check if it's a continue statement
                                    if (t.isContinueStatement(node.consequent)) {
                                        // Remove the entire IfStatement if its consequent is a continue statement
                                        arr.splice(index, 1);
                                    }
                                }
                            }
                            // Additionally, handle continue statements directly in case blocks
                            if (t.isContinueStatement(node)) {
                                arr.splice(index, 1);
                            }
                        });
                        cases[caseNode.test.value] = caseNode;
                    }
                });
                // Find the initial case
                initialCase = cases[startCase];
                // Create a sequence of statements based on the initial case and progression
                const sequence = [];
                let currentCase = initialCase;
                while (currentCase) {
                    sequence.push(...currentCase.consequent);

                    // Determine the next case based on the update to the switch variable
                    const nextValue = currentCase.consequent.find(node =>
                        t.isAssignmentExpression(node) &&
                        t.isIdentifier(node.left) &&
                        node.left.name === switchVar &&
                        t.isNumericLiteral(node.right)
                    );
                    if (nextValue) {
                        currentCase = cases[nextValue.right.value];
                    } else {
                        break;
                    }
                }
                // Replace the for loop with the sequence of statements
                path.replaceWithMultiple(sequence);
            }
        }
    });
    return matches;
}

module.exports = reorderSwitchCases;
