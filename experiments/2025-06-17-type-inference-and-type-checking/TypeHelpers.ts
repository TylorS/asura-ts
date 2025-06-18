import { 
  Type, 
  TypeVariable, 
  TypeConstructor, 
  PrimitiveType, 
  FunctionType, 
  RecordType, 
  VariantType, 
  ApplicationType, 
  ForallType, 
  EffectType, 
  HandlerType,
  RowType,
  Variance,
  OperationType,
  HandlerOperation,
  TypeParameter 
} from './Type.ts'

// Factory functions for creating types
export class TypeFactory {
  private static nextId = 0

  // Primitive types
  static number(): PrimitiveType {
    return { kind: 'PrimitiveType', name: 'number' }
  }

  static string(): PrimitiveType {
    return { kind: 'PrimitiveType', name: 'string' }
  }

  static boolean(): PrimitiveType {
    return { kind: 'PrimitiveType', name: 'boolean' }
  }

  static unit(): PrimitiveType {
    return { kind: 'PrimitiveType', name: 'unit' }
  }

  // Type variables
  static typeVar(name: string, variance?: Variance): TypeVariable {
    return {
      kind: 'TypeVariable',
      name,
      id: this.nextId++,
      variance
    }
  }

  // Function types
  static func(params: Type[], returnType: Type, effects: Type[] = []): FunctionType {
    return {
      kind: 'FunctionType',
      parameters: params,
      returnType,
      effects
    }
  }

  // Record types
  static record(fields: Record<string, Type>): RecordType {
    const fieldMap = new Map(Object.entries(fields))
    return {
      kind: 'RecordType',
      row: {
        kind: 'RowType',
        fields: fieldMap
      }
    }
  }

  // Variant types
  static variant(alternatives: Record<string, Type>): VariantType {
    const altMap = new Map(Object.entries(alternatives))
    return {
      kind: 'VariantType',
      row: {
        kind: 'RowType',
        fields: altMap
      }
    }
  }

  // ForAll types (polymorphic types)
  static forall(variables: TypeVariable[], body: Type): ForallType {
    return {
      kind: 'ForallType',
      variables,
      body
    }
  }

  // Higher-kinded type constructors
  static typeConstructor(name: string, arity: number, parameters: TypeParameter[] = []): TypeConstructor {
    return {
      kind: 'TypeConstructor',
      name,
      arity,
      parameters
    }
  }

  // Type application
  static apply(constructor: Type, args: Type[]): ApplicationType {
    return {
      kind: 'ApplicationType',
      constructor,
      arguments: args
    }
  }

  // Effect types
  static effect(name: string, operations: Record<string, OperationType>): EffectType {
    return {
      kind: 'EffectType',
      name,
      operations: new Map(Object.entries(operations))
    }
  }

  // Handler types
  static handler(effect: EffectType, returnType: Type, operations: Record<string, HandlerOperation>): HandlerType {
    return {
      kind: 'HandlerType',
      effect,
      returnType,
      operations: new Map(Object.entries(operations))
    }
  }

  // Row types
  static row(fields: Record<string, Type>, tail?: Type): RowType {
    return {
      kind: 'RowType',
      fields: new Map(Object.entries(fields)),
      tail
    }
  }
}

// Common type constructors and examples
export class CommonTypes {
  // Option type - Maybe/Optional
  static Option = TypeFactory.typeConstructor('Option', 1, [
    { name: 'T', variance: 'covariant' }
  ])

  static Some<T extends Type>(value: T): ApplicationType {
    return TypeFactory.apply(this.Option, [value])
  }

  // List type
  static List = TypeFactory.typeConstructor('List', 1, [
    { name: 'T', variance: 'bivariant' }
  ])

  static list<T extends Type>(elementType: T): ApplicationType {
    return TypeFactory.apply(this.List, [elementType])
  }

  // Either type
  static Either = TypeFactory.typeConstructor('Either', 2, [
    { name: 'L', variance: 'covariant' },
    { name: 'R', variance: 'covariant' }
  ])

  static either<L extends Type, R extends Type>(left: L, right: R): ApplicationType {
    return TypeFactory.apply(this.Either, [left, right])
  }

  // State effect
  static StateEffect = TypeFactory.effect('State', {
    get: {
      parameters: [],
      returnType: TypeFactory.typeVar('S'),
      resumeType: TypeFactory.typeVar('S')
    },
    put: {
      parameters: [TypeFactory.typeVar('S')],
      returnType: TypeFactory.unit(),
      resumeType: TypeFactory.unit()
    }
  })

  // IO effect
  static IOEffect = TypeFactory.effect('IO', {
    read: {
      parameters: [],
      returnType: TypeFactory.string(),
      resumeType: TypeFactory.string()
    },
    write: {
      parameters: [TypeFactory.string()],
      returnType: TypeFactory.unit(),
      resumeType: TypeFactory.unit()
    }
  })

  // Examples of polymorphic types
  static identity(): ForallType {
    const t = TypeFactory.typeVar('T')
    return TypeFactory.forall([t], TypeFactory.func([t], t))
  }

  static map(): ForallType {
    const a = TypeFactory.typeVar('A')
    const b = TypeFactory.typeVar('B')
    return TypeFactory.forall(
      [a, b],
      TypeFactory.func(
        [TypeFactory.func([a], b), this.list(a)],
        this.list(b)
      )
    )
  }

  // Extensible record example
  static extendibleRecord(): ForallType {
    const r = TypeFactory.typeVar('R')
    return TypeFactory.forall(
      [r],
      TypeFactory.record({
        name: TypeFactory.string(),
        age: TypeFactory.number()
      })
    )
  }
}

// Type pretty printing for debugging - TypeScript-friendly syntax
export class TypePrinter {
  static print(type: Type, depth: number = 0): string {
    switch (type.kind) {
      case 'PrimitiveType':
        return type.name === 'unit' ? 'void' : type.name
      
      case 'TypeVariable': {
        const variance = type.variance ? this.printVariance(type.variance) : ''
        return variance ? `${variance} ${type.name}` : type.name
      }
      case 'TypeConstructor':
        return type.name // Just the name, will be applied with <> later
      
      case 'FunctionType': {
        const params = type.parameters.length === 0 
          ? '()' 
          : type.parameters
              .map((p, i) => `arg${i}: ${this.print(p, depth + 1)}`)
              .join(', ')
        
        const effects = type.effects.length > 0 
          ? ` /* effects: ${type.effects.map(e => this.print(e, depth + 1)).join(', ')} */`
          : ''
        
        return `(${params}) => ${this.print(type.returnType, depth + 1)}${effects}`
      }
      
      case 'RecordType': {
        if (type.row.fields.size === 0) {
          return '{}'
        }
        
        const fields = Array.from(type.row.fields.entries())
          .map(([name, t]) => `  ${name}: ${this.print(t, depth + 1)}`)
          .join(';\n')
        
        const tail = type.row.tail ? `\n  // ...${this.print(type.row.tail, depth + 1)}` : ''
        
        return depth === 0 
          ? `{\n${fields}${tail}\n}`
          : `{ ${Array.from(type.row.fields.entries()).map(([name, t]) => `${name}: ${this.print(t, depth + 1)}`).join('; ')} }`
      }
      
      case 'VariantType': {
        const alts = Array.from(type.row.fields.entries())
          .map(([name, t]) => {
            // Handle unit types as simple tags
            if (t.kind === 'PrimitiveType' && t.name === 'unit') {
              return `"${name}"`
            }
            // Handle more complex types
            return `{ type: "${name}"; value: ${this.print(t, depth + 1)} }`
          })
          .join(' | ')
        return alts
      }
      
      case 'ApplicationType': {
        const constructor = this.print(type.constructor, depth + 1)
        const args = type.arguments.map(arg => this.print(arg, depth + 1)).join(', ')
        
        // Special handling for common types
        if (constructor === 'Option') {
          return `${args} | null`
        }
        if (constructor === 'List') {
          return `Array<${args}>`
        }
        if (constructor === 'Either') {
          const [left, right] = type.arguments.map(arg => this.print(arg, depth + 1))
          return `{ tag: "Left"; value: ${left} } | { tag: "Right"; value: ${right} }`
        }
        
        return `${constructor}<${args}>`
      }
      
      case 'ForallType': {
        // Convert to TypeScript generic syntax
        const typeParams = type.variables.map(v => {
          const constraint = v.variance ? ` /* ${this.printVariance(v.variance)} */` : ''
          return `${v.name}${constraint}`
        }).join(', ')
        
        const body = this.print(type.body, depth + 1)
        
        // If it's a function type, integrate the generics
        if (type.body.kind === 'FunctionType') {
          const funcBody = type.body as FunctionType
          const params = funcBody.parameters.length === 0 
            ? '()' 
            : funcBody.parameters
                .map((p, i) => `arg${i}: ${this.print(p, depth + 1)}`)
                .join(', ')
          
          const effects = funcBody.effects.length > 0 
            ? ` /* effects: ${funcBody.effects.map(e => this.print(e, depth + 1)).join(', ')} */`
            : ''
          
          return `<${typeParams}>(${params}) => ${this.print(funcBody.returnType, depth + 1)}${effects}`
        }
        
        return `<${typeParams}> ${body}`
      }
      
      case 'EffectType': {
        const ops = Array.from(type.operations.entries())
          .map(([name, op]) => {
            const params = op.parameters.length === 0
              ? '()'
              : `(${op.parameters.map((p, i) => `arg${i}: ${this.print(p, depth + 1)}`).join(', ')})`
            return `  ${name}${params}: ${this.print(op.returnType, depth + 1)}`
          })
          .join(';\n')
        
        return `interface ${type.name}Effect {\n${ops}\n}`
      }
      
      case 'HandlerType': {
        const ops = Array.from(type.operations.entries())
          .map(([name, op]) => {
            const params = op.parameters.length === 0
              ? '()'
              : `(${op.parameters.map((p: Type, i: number) => `arg${i}: ${this.print(p, depth + 1)}`).join(', ')})`
            const continuation = `(resume: (value: ${this.print(op.continuationType, depth + 1)}) => void)`
            return `  ${name}${params}${params === '()' ? continuation : `, ${continuation}`}: ${this.print(op.resultType, depth + 1)}`
          })
          .join(';\n')
        
        return `interface ${type.effect.name}Handler {\n${ops}\n  return: (value: any) => ${this.print(type.returnType, depth + 1)}\n}`
      }
      
      default:
        return 'unknown'
    }
  }
  
  private static printVariance(variance: Variance): string {
    switch (variance) {
      case 'covariant': return 'out'
      case 'contravariant': return 'in'
      case 'invariant': return ''
      case 'bivariant': return 'in out'
      default: return ''
    }
  }
  
  // Helper method for more readable type descriptions
  static describe(type: Type): string {
    switch (type.kind) {
      case 'PrimitiveType':
        return `primitive type '${type.name === 'unit' ? 'void' : type.name}'`
      
      case 'TypeVariable':
        return `type parameter '${type.name}'`
      
      case 'FunctionType': {
        const paramCount = type.parameters.length
        const effectCount = type.effects.length
        const effectDesc = effectCount > 0 ? ` with ${effectCount} effect(s)` : ''
        return `function with ${paramCount} parameter(s)${effectDesc}`
      }
      case 'RecordType': {
        const fieldCount = type.row.fields.size
        return `record with ${fieldCount} field(s)`
      }
      case 'VariantType': {
        const altCount = type.row.fields.size
        return `union type with ${altCount} alternative(s)`
      }
      case 'ApplicationType': {
        return `generic type application`
      }
      case 'ForallType': {
        const varCount = type.variables.length
        return `polymorphic type with ${varCount} type parameter(s)`
      }
      case 'EffectType': {
        const opCount = type.operations.size
        return `effect '${type.name}' with ${opCount} operation(s)`
      }
      case 'HandlerType': {
        return `handler for effect '${type.effect.name}'`
      }
      default:
        return 'unknown type'
    }
  }
}

// Example usage and demonstrations
export function createExamples() {
  const examples = {
    // Basic types
    primitives: {
      number: TypeFactory.number(),
      string: TypeFactory.string(),
      boolean: TypeFactory.boolean()
    },

    // Function types
    functions: {
      identity: CommonTypes.identity(),
      map: CommonTypes.map(),
      addNumbers: TypeFactory.func([TypeFactory.number(), TypeFactory.number()], TypeFactory.number())
    },

    // Structural types
    structural: {
      person: TypeFactory.record({
        name: TypeFactory.string(),
        age: TypeFactory.number(),
        email: TypeFactory.string()
      }),
      
      result: CommonTypes.either(TypeFactory.string(), TypeFactory.number()),
      
      optionalString: CommonTypes.Some(TypeFactory.string())
    },

    // Higher-kinded types
    higherKinded: {
      listOfNumbers: CommonTypes.list(TypeFactory.number()),
      listOfStrings: CommonTypes.list(TypeFactory.string()),
      optionOfList: CommonTypes.Some(CommonTypes.list(TypeFactory.string()))
    },

    // Effect types
    effects: {
      stateEffect: CommonTypes.StateEffect,
      ioEffect: CommonTypes.IOEffect,
      
      statefulFunction: TypeFactory.func(
        [TypeFactory.number()],
        TypeFactory.number(),
        [CommonTypes.StateEffect]
      )
    },

    // Row polymorphism examples
    rowPolymorphism: {
      extensiblePerson: TypeFactory.record({
        name: TypeFactory.string(),
        age: TypeFactory.number()
      }),
      
      extendedPerson: TypeFactory.record({
        name: TypeFactory.string(),
        age: TypeFactory.number(),
        email: TypeFactory.string(),
        phone: TypeFactory.string()
      })
    }
  }

  return examples
} 