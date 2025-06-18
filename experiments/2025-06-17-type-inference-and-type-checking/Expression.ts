import { Type } from './Type.ts'

// Expression ADT for the language constructs we want to infer types for
export type Expression =
  | { kind: 'Literal'; value: number | string | boolean }
  | { kind: 'Variable'; name: string }
  | { kind: 'Lambda'; parameter: string; body: Expression }
  | { kind: 'Application'; function: Expression; argument: Expression }
  | { kind: 'Let'; variable: string; value: Expression; body: Expression }
  | { kind: 'Record'; fields: Map<string, Expression> }
  | { kind: 'FieldAccess'; record: Expression; field: string }
  | { kind: 'Variant'; tag: string; value: Expression }
  | { kind: 'Match'; expression: Expression; cases: Map<string, MatchCase> }
  | { kind: 'EffectOperation'; effect: string; operation: string; arguments: Expression[] }
  | { kind: 'Handle'; expression: Expression; handlers: Map<string, HandlerCase>; returnCase: Expression }
  | { kind: 'TypeAnnotation'; expression: Expression; type: Type }

export type MatchCase = {
  parameter: string
  body: Expression
}

export type HandlerCase = {
  parameters: string[]
  resumeParameter: string
  body: Expression
}

// Helper functions for creating expressions
export class ExpressionFactory {
  static literal(value: number | string | boolean): Expression {
    return { kind: 'Literal', value }
  }

  static variable(name: string): Expression {
    return { kind: 'Variable', name }
  }

  static lambda(parameter: string, body: Expression): Expression {
    return { kind: 'Lambda', parameter, body }
  }

  static application(func: Expression, arg: Expression): Expression {
    return { kind: 'Application', function: func, argument: arg }
  }

  static let(variable: string, value: Expression, body: Expression): Expression {
    return { kind: 'Let', variable, value, body }
  }

  static record(fields: Record<string, Expression>): Expression {
    return { kind: 'Record', fields: new Map(Object.entries(fields)) }
  }

  static fieldAccess(record: Expression, field: string): Expression {
    return { kind: 'FieldAccess', record, field }
  }

  static variant(tag: string, value: Expression): Expression {
    return { kind: 'Variant', tag, value }
  }

  static match(expression: Expression, cases: Record<string, MatchCase>): Expression {
    return { kind: 'Match', expression, cases: new Map(Object.entries(cases)) }
  }

  static effectOp(effect: string, operation: string, args: Expression[]): Expression {
    return { kind: 'EffectOperation', effect, operation, arguments: args }
  }

  static handle(expression: Expression, handlers: Record<string, HandlerCase>, returnCase: Expression): Expression {
    return { kind: 'Handle', expression, handlers: new Map(Object.entries(handlers)), returnCase }
  }

  static typeAnnotation(expression: Expression, type: Type): Expression {
    return { kind: 'TypeAnnotation', expression, type }
  }
}

// Expression pretty printer
export class ExpressionPrinter {
  static print(expr: Expression, indent: number = 0): string {    
    switch (expr.kind) {
      case 'Literal':
        return typeof expr.value === 'string' ? `"${expr.value}"` : String(expr.value)
      
      case 'Variable':
        return expr.name
      
      case 'Lambda':
        return `(${expr.parameter}) => ${this.print(expr.body, indent)}`
      
      case 'Application':
        return `${this.print(expr.function, indent)}(${this.print(expr.argument, indent)})`
      
      case 'Let':
        return `let ${expr.variable} = ${this.print(expr.value, indent)} in ${this.print(expr.body, indent)}`
      
      case 'Record': {
        const fields = Array.from(expr.fields.entries())
          .map(([name, val]) => `${name}: ${this.print(val, indent + 1)}`)
          .join(', ')
        return `{ ${fields} }`
      }
      
      case 'FieldAccess':
        return `${this.print(expr.record, indent)}.${expr.field}`
      
      case 'Variant':
        return `${expr.tag}(${this.print(expr.value, indent)})`
      
      case 'Match': {
        const cases = Array.from(expr.cases.entries())
          .map(([tag, matchCase]) => `${tag}(${matchCase.parameter}) => ${this.print(matchCase.body, indent + 1)}`)
          .join(', ')
        return `match ${this.print(expr.expression, indent)} { ${cases} }`
      }
      
      case 'EffectOperation': {
        const args = expr.arguments.map(arg => this.print(arg, indent)).join(', ')
        return `${expr.effect}.${expr.operation}(${args})`
      }
      
      case 'Handle': {
        const handlers = Array.from(expr.handlers.entries())
          .map(([op, handler]) => {
            const params = handler.parameters.join(', ')
            return `${op}(${params}, ${handler.resumeParameter}) => ${this.print(handler.body, indent + 1)}`
          })
          .join(', ')
        return `handle ${this.print(expr.expression, indent)} { ${handlers}, return => ${this.print(expr.returnCase, indent)} }`
      }
      
      case 'TypeAnnotation':
        return `(${this.print(expr.expression, indent)} : ${expr.type})`
      
      default:
        return 'unknown'
    }
  }
} 