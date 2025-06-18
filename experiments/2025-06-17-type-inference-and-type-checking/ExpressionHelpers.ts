import { Expression, HandlerCase, MatchCase } from "./Expression.ts";
import { Type } from "./Type.ts";

/**
 * Expression builder helpers for creating test expressions easily
 */
export class ExpressionBuilder {
  // Literals
  static num(value: number): Expression {
    return { kind: "Literal", value };
  }

  static str(value: string): Expression {
    return { kind: "Literal", value };
  }

  static bool(value: boolean): Expression {
    return { kind: "Literal", value };
  }

  // Variables
  static var(name: string): Expression {
    return { kind: "Variable", name };
  }

  // Functions
  static lambda(parameter: string, body: Expression): Expression {
    return { kind: "Lambda", parameter, body };
  }

  static app(func: Expression, arg: Expression): Expression {
    return { kind: "Application", function: func, argument: arg };
  }

  // Multi-parameter lambda using currying
  static lambdaMulti(parameters: string[], body: Expression): Expression {
    return parameters.reduceRight(
      (acc, param) => this.lambda(param, acc),
      body,
    );
  }

  // Function application with multiple arguments
  static appMulti(func: Expression, args: Expression[]): Expression {
    return args.reduce((acc, arg) => this.app(acc, arg), func);
  }

  // Let bindings
  static let(
    variable: string,
    value: Expression,
    body: Expression,
  ): Expression {
    return { kind: "Let", variable, value, body };
  }

  // Records
  static record(fields: Record<string, Expression>): Expression {
    return {
      kind: "Record",
      fields: new Map(Object.entries(fields)),
    };
  }

  static field(record: Expression, field: string): Expression {
    return { kind: "FieldAccess", record, field };
  }

  // Variants
  static variant(tag: string, value: Expression): Expression {
    return { kind: "Variant", tag, value };
  }

  static match(
    expression: Expression,
    cases: Record<string, MatchCase>,
  ): Expression {
    return {
      kind: "Match",
      expression,
      cases: new Map(Object.entries(cases)),
    };
  }

  // Effects
  static effectOp(
    effect: string,
    operation: string,
    args: Expression[],
  ): Expression {
    return { kind: "EffectOperation", effect, operation, arguments: args };
  }

  static handle(
    expression: Expression,
    handlers: Record<string, HandlerCase>,
    returnCase: Expression,
  ): Expression {
    return {
      kind: "Handle",
      expression,
      handlers: new Map(Object.entries(handlers)),
      returnCase,
    };
  }

  // Type annotations
  static annotate(expression: Expression, type: Type): Expression {
    return { kind: "TypeAnnotation", expression, type };
  }
}

/**
 * Common expression patterns for testing
 */
export class CommonExpressions {
  // Identity function: (x) => x
  static identity(): Expression {
    return ExpressionBuilder.lambda("x", ExpressionBuilder.var("x"));
  }

  // Constant function: (x) => (y) => x
  static const(): Expression {
    return ExpressionBuilder.lambdaMulti(
      ["x", "y"],
      ExpressionBuilder.var("x"),
    );
  }

  // Function composition: (f) => (g) => (x) => f(g(x))
  static compose(): Expression {
    return ExpressionBuilder.lambdaMulti(
      ["f", "g", "x"],
      ExpressionBuilder.app(
        ExpressionBuilder.var("f"),
        ExpressionBuilder.app(
          ExpressionBuilder.var("g"),
          ExpressionBuilder.var("x"),
        ),
      ),
    );
  }

  // Pipe/reverse composition: (f) => (g) => (x) => g(f(x))
  static pipe(): Expression {
    return ExpressionBuilder.lambdaMulti(
      ["f", "g", "x"],
      ExpressionBuilder.app(
        ExpressionBuilder.var("g"),
        ExpressionBuilder.app(
          ExpressionBuilder.var("f"),
          ExpressionBuilder.var("x"),
        ),
      ),
    );
  }

  // Flip: (f) => (x) => (y) => f(y)(x)
  static flip(): Expression {
    return ExpressionBuilder.lambdaMulti(
      ["f", "x", "y"],
      ExpressionBuilder.appMulti(
        ExpressionBuilder.var("f"),
        [ExpressionBuilder.var("y"), ExpressionBuilder.var("x")],
      ),
    );
  }

  // Map function: (f) => (list) => ... (simplified for demo)
  static map(): Expression {
    return ExpressionBuilder.lambdaMulti(
      ["f", "list"],
      ExpressionBuilder.var("list"), // Simplified - would need list operations
    );
  }

  // Y combinator (for recursion): (f) => ((x) => f((v) => x(x)(v)))((x) => f((v) => x(x)(v)))
  static yCombinator(): Expression {
    const innerLambda = ExpressionBuilder.lambda(
      "x",
      ExpressionBuilder.app(
        ExpressionBuilder.var("f"),
        ExpressionBuilder.lambda(
          "v",
          ExpressionBuilder.appMulti(
            ExpressionBuilder.var("x"),
            [ExpressionBuilder.var("x"), ExpressionBuilder.var("v")],
          ),
        ),
      ),
    );

    return ExpressionBuilder.lambda(
      "f",
      ExpressionBuilder.app(innerLambda, innerLambda),
    );
  }

  // Person record
  static person(name: string, age: number): Expression {
    return ExpressionBuilder.record({
      name: ExpressionBuilder.str(name),
      age: ExpressionBuilder.num(age),
    });
  }

  // Option type constructors
  static some(value: Expression): Expression {
    return ExpressionBuilder.variant("Some", value);
  }

  static none(): Expression {
    return ExpressionBuilder.variant("None", ExpressionBuilder.record({}));
  }

  // Either type constructors
  static left(value: Expression): Expression {
    return ExpressionBuilder.variant("Left", value);
  }

  static right(value: Expression): Expression {
    return ExpressionBuilder.variant("Right", value);
  }

  // List operations (simplified)
  static list(elements: Expression[]): Expression {
    // For demo purposes, represent as a record with elements
    const fields: Record<string, Expression> = {};
    elements.forEach((elem, i) => {
      fields[`_${i}`] = elem;
    });
    fields["length"] = ExpressionBuilder.num(elements.length);
    return ExpressionBuilder.record(fields);
  }

  // Let polymorphism example: let id = (x) => x in (id(42), id("hello"))
  static letPolymorphism(): Expression {
    return ExpressionBuilder.let(
      "id",
      this.identity(),
      ExpressionBuilder.record({
        numberResult: ExpressionBuilder.app(
          ExpressionBuilder.var("id"),
          ExpressionBuilder.num(42),
        ),
        stringResult: ExpressionBuilder.app(
          ExpressionBuilder.var("id"),
          ExpressionBuilder.str("hello"),
        ),
      }),
    );
  }

  // Nested field access: person.address.street
  static nestedFieldAccess(): Expression {
    const person = ExpressionBuilder.record({
      name: ExpressionBuilder.str("Alice"),
      address: ExpressionBuilder.record({
        street: ExpressionBuilder.str("Main St"),
        city: ExpressionBuilder.str("Anytown"),
      }),
    });

    return ExpressionBuilder.field(
      ExpressionBuilder.field(person, "address"),
      "street",
    );
  }
}

/**
 * Expression test case builder
 */
export interface TestCase {
  name: string;
  expression: Expression;
  description?: string;
  expectedType?: string;
  shouldFail?: boolean;
}

export class TestCaseBuilder {
  static create(
    name: string,
    expression: Expression,
    options: {
      description?: string;
      expectedType?: string;
      shouldFail?: boolean;
    } = {},
  ): TestCase {
    return {
      name,
      expression,
      ...options,
    };
  }

  // Predefined test suites
  static basicTypes(): TestCase[] {
    return [
      this.create("Number literal", ExpressionBuilder.num(42)),
      this.create("String literal", ExpressionBuilder.str("hello")),
      this.create("Boolean literal", ExpressionBuilder.bool(true)),
    ];
  }

  static functions(): TestCase[] {
    return [
      this.create("Identity function", CommonExpressions.identity()),
      this.create("Constant function", CommonExpressions.const()),
      this.create("Function composition", CommonExpressions.compose()),
      this.create("Pipe function", CommonExpressions.pipe()),
      this.create("Flip function", CommonExpressions.flip()),
    ];
  }

  static records(): TestCase[] {
    return [
      this.create("Simple record", CommonExpressions.person("Alice", 30)),
      this.create(
        "Field access",
        ExpressionBuilder.field(CommonExpressions.person("Bob", 25), "name"),
      ),
      this.create("Nested field access", CommonExpressions.nestedFieldAccess()),
    ];
  }

  static polymorphism(): TestCase[] {
    return [
      this.create("Let polymorphism", CommonExpressions.letPolymorphism()),
      this.create("Y combinator", CommonExpressions.yCombinator(), {
        description: "Fixed-point combinator for recursion",
      }),
    ];
  }

  static variants(): TestCase[] {
    return [
      this.create(
        "Option Some",
        CommonExpressions.some(ExpressionBuilder.num(42)),
      ),
      this.create("Option None", CommonExpressions.none()),
      this.create(
        "Either Left",
        CommonExpressions.left(ExpressionBuilder.str("error")),
      ),
      this.create(
        "Either Right",
        CommonExpressions.right(ExpressionBuilder.num(100)),
      ),
    ];
  }

  static all(): TestCase[] {
    return [
      ...this.basicTypes(),
      ...this.functions(),
      ...this.records(),
      ...this.polymorphism(),
      ...this.variants(),
    ];
  }
}
