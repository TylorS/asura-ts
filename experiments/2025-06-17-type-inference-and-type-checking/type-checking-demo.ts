import { TypeChecker } from "./TypeChecker.ts";
import {
  CommonTypes,
  createExamples,
  TypeFactory,
  TypePrinter,
} from "./TypeHelpers.ts";

// Comprehensive demo of the type-checker capabilities
export function runTypeCheckerDemo() {
  console.log("🚀 Asura Type-Checker Demo");
  console.log("📖 Now with TypeScript-friendly syntax!\n");

  const checker = new TypeChecker();
  const examples = createExamples();

  // Demo 1: Basic structural typing
  console.log("=== 1. Structural Typing ===");
  const person = examples.structural.person;
  const extendedPerson = examples.rowPolymorphism.extendedPerson;

  console.log("Person type:", TypePrinter.print(person));
  console.log("Extended person type:", TypePrinter.print(extendedPerson));
  console.log(
    "Extended person <: Person?",
    checker.isSubtype(extendedPerson, person),
  );
  console.log(
    "Person <: Extended person?",
    checker.isSubtype(person, extendedPerson),
  );
  console.log("");

  // Demo 2: Higher-kinded types
  console.log("=== 2. Higher-Kinded Types ===");
  const listOfNumbers = examples.higherKinded.listOfNumbers;
  const listOfStrings = examples.higherKinded.listOfStrings;

  console.log("List<number>:", TypePrinter.print(listOfNumbers));
  console.log("List<string>:", TypePrinter.print(listOfStrings));

  // Create a covariant List constructor
  const List = CommonTypes.List;
  console.log("List constructor:", TypePrinter.print(List));

  // Apply List to different types
  const appliedList = checker.applyTypeConstructor(List, [
    TypeFactory.boolean(),
  ]);
  console.log("List<boolean>:", TypePrinter.print(appliedList));

  // Demonstrate covariance in higher-kinded types
  // Create Animal and Dog types
  const animalType = TypeFactory.record({ name: TypeFactory.string() });
  const dogType = TypeFactory.record({
    name: TypeFactory.string(),
    breed: TypeFactory.string(),
  });

  const listOfAnimals = CommonTypes.list(animalType);
  const listOfDogs = CommonTypes.list(dogType);

  console.log("Animal type:", TypePrinter.print(animalType));
  console.log("Dog type:", TypePrinter.print(dogType));
  console.log("List<Animal>:", TypePrinter.print(listOfAnimals));
  console.log("List<Dog>:", TypePrinter.print(listOfDogs));
  console.log("Dog <: Animal?", checker.isSubtype(dogType, animalType));
  console.log(
    "List<Dog> <: List<Animal>? (covariance)",
    checker.isSubtype(listOfDogs, listOfAnimals),
  );
  console.log("");

  // Demo 3: ForAll types (Polymorphism)
  console.log("=== 3. ForAll Types (Polymorphism) ===");
  const identity = examples.functions.identity;
  const mapFunc = examples.functions.map;

  console.log("Identity function type:", TypePrinter.print(identity));
  console.log("Map function type:", TypePrinter.print(mapFunc));

  // Instantiate identity function
  const numberIdentity = checker.instantiate(identity, [TypeFactory.number()]);
  console.log(
    "Identity instantiated for numbers:",
    TypePrinter.print(numberIdentity),
  );

  const stringIdentity = checker.instantiate(identity, [TypeFactory.string()]);
  console.log(
    "Identity instantiated for strings:",
    TypePrinter.print(stringIdentity),
  );

  // Demonstrate polymorphic subtyping
  // More specific polymorphic functions are subtypes of more general ones
  const constrainedIdentity = TypeFactory.forall(
    [TypeFactory.typeVar("T")],
    TypeFactory.func([TypeFactory.typeVar("T")], TypeFactory.typeVar("T")),
  );

  const numberOnlyIdentity = TypeFactory.func(
    [TypeFactory.number()],
    TypeFactory.number(),
  );

  console.log("Constrained identity:", TypePrinter.print(constrainedIdentity));
  console.log("Number-only identity:", TypePrinter.print(numberOnlyIdentity));
  console.log(
    "Number identity <: Polymorphic identity?",
    checker.isSubtype(numberOnlyIdentity, numberIdentity),
  );
  console.log("");

  // Demo 4: Variance in higher-kinded types
  console.log("=== 4. Variance ===");

  // Create function types to show contravariance in parameters
  const funcNumberToString = TypeFactory.func(
    [TypeFactory.number()],
    TypeFactory.string(),
  );
  const funcAnyToString = TypeFactory.func(
    [TypeFactory.typeVar("any")],
    TypeFactory.string(),
  );

  console.log("(number) -> string:", TypePrinter.print(funcNumberToString));
  console.log("(any) -> string:", TypePrinter.print(funcAnyToString));

  // Demonstrate function variance
  const funcAnimalToString = TypeFactory.func(
    [animalType],
    TypeFactory.string(),
  );
  const funcDogToString = TypeFactory.func([dogType], TypeFactory.string());
  const funcAnimalToAnimal = TypeFactory.func([animalType], animalType);
  const funcAnimalToDog = TypeFactory.func([animalType], dogType);

  console.log("(Animal) -> string:", TypePrinter.print(funcAnimalToString));
  console.log("(Dog) -> string:", TypePrinter.print(funcDogToString));
  console.log("(Animal) -> Animal:", TypePrinter.print(funcAnimalToAnimal));
  console.log("(Animal) -> Dog:", TypePrinter.print(funcAnimalToDog));

  // Function subtyping: parameters contravariant, return types covariant
  console.log(
    "(Animal) -> string <: (Dog) -> string? (contravariant params)",
    checker.isSubtype(funcAnimalToString, funcDogToString),
  );
  console.log(
    "(Dog) -> string <: (Animal) -> string? (contravariant params)",
    checker.isSubtype(funcDogToString, funcAnimalToString),
  );
  console.log(
    "(Animal) -> Dog <: (Animal) -> Animal? (covariant return)",
    checker.isSubtype(funcAnimalToDog, funcAnimalToAnimal),
  );
  console.log(
    "(Animal) -> Animal <: (Animal) -> Dog? (covariant return)",
    checker.isSubtype(funcAnimalToAnimal, funcAnimalToDog),
  );
  console.log("");

  // Demo 5: Row types and extensibility
  console.log("=== 5. Row Types and Extensibility ===");

  // Create a row type
  const baseRow = TypeFactory.row({
    name: TypeFactory.string(),
    age: TypeFactory.number(),
  });

  // Extend the row
  const extendedRow = checker.extendRow(
    baseRow,
    new Map([
      ["email", TypeFactory.string()],
      ["phone", TypeFactory.string()],
    ]),
  );

  console.log(
    "Base row:",
    TypePrinter.print({ kind: "RecordType", row: baseRow }),
  );
  console.log(
    "Extended row:",
    TypePrinter.print({ kind: "RecordType", row: extendedRow }),
  );

  // Restrict the row
  const restrictedRow = checker.restrictRow(extendedRow, ["phone"]);
  console.log(
    "Restricted row (removed phone):",
    TypePrinter.print({ kind: "RecordType", row: restrictedRow }),
  );

  // Demonstrate row subtyping
  const baseRecord = TypeFactory.record({
    name: TypeFactory.string(),
    age: TypeFactory.number(),
  });
  const extendedRecord = TypeFactory.record({
    name: TypeFactory.string(),
    age: TypeFactory.number(),
    email: TypeFactory.string(),
  });

  console.log(
    "Base record <: Extended record?",
    checker.isSubtype(baseRecord, extendedRecord),
  );
  console.log(
    "Extended record <: Base record? (width subtyping)",
    checker.isSubtype(extendedRecord, baseRecord),
  );
  console.log("");

  // Demo 6: Effect types
  console.log("=== 6. Effect Types ===");
  const stateEffect = examples.effects.stateEffect;
  const ioEffect = examples.effects.ioEffect;
  const statefulFunc = examples.effects.statefulFunction;

  console.log("State effect:", TypePrinter.print(stateEffect));
  console.log("IO effect:", TypePrinter.print(ioEffect));
  console.log("Stateful function:", TypePrinter.print(statefulFunc));

  // Create a handler for the state effect
  const stateHandler = TypeFactory.handler(
    stateEffect,
    TypeFactory.number(),
    {
      get: {
        parameters: [],
        continuationType: TypeFactory.number(),
        resultType: TypeFactory.number(),
      },
      put: {
        parameters: [TypeFactory.number()],
        continuationType: TypeFactory.unit(),
        resultType: TypeFactory.unit(),
      },
    },
  );

  console.log("State handler:", TypePrinter.print(stateHandler));
  console.log(
    "Handler is compatible with effect?",
    checker.checkHandler(stateHandler, stateEffect),
  );

  // Demonstrate effect subtyping (more effects <: fewer effects)
  const pureFunction = TypeFactory.func(
    [TypeFactory.number()],
    TypeFactory.number(),
    [],
  );
  const ioFunction = TypeFactory.func(
    [TypeFactory.number()],
    TypeFactory.number(),
    [ioEffect],
  );
  const statefulIoFunction = TypeFactory.func(
    [TypeFactory.number()],
    TypeFactory.number(),
    [stateEffect, ioEffect],
  );

  console.log("Pure function:", TypePrinter.print(pureFunction));
  console.log("IO function:", TypePrinter.print(ioFunction));
  console.log("Stateful+IO function:", TypePrinter.print(statefulIoFunction));
  console.log(
    "Pure <: IO function? (effect subtyping)",
    checker.isSubtype(pureFunction, ioFunction),
  );
  console.log(
    "IO <: Stateful+IO function? (effect subtyping)",
    checker.isSubtype(ioFunction, statefulIoFunction),
  );
  console.log(
    "Stateful+IO <: IO function? (effect subtyping)",
    checker.isSubtype(statefulIoFunction, ioFunction),
  );
  console.log("");

  // Demo 7: Complex polymorphic types
  console.log("=== 7. Complex Polymorphic Types ===");

  // Create a more complex polymorphic type: (a -> b) -> List<a> -> List<b>
  const a = TypeFactory.typeVar("a");
  const b = TypeFactory.typeVar("b");
  const mapType = TypeFactory.forall(
    [a, b],
    TypeFactory.func(
      [
        TypeFactory.func([a], b),
        CommonTypes.list(a),
      ],
      CommonTypes.list(b),
    ),
  );

  console.log("Complex map type:", TypePrinter.print(mapType));

  // Instantiate it for specific types
  const stringToNumberMap = checker.instantiate(mapType, [
    TypeFactory.string(),
    TypeFactory.number(),
  ]);
  console.log(
    "Map instantiated for string->number:",
    TypePrinter.print(stringToNumberMap),
  );

  // Create more specific map functions to show subtyping
  const animalToStringMap = checker.instantiate(mapType, [
    animalType,
    TypeFactory.string(),
  ]);
  const dogToStringMap = checker.instantiate(mapType, [
    dogType,
    TypeFactory.string(),
  ]);

  console.log("Animal->string map:", TypePrinter.print(animalToStringMap));
  console.log("Dog->string map:", TypePrinter.print(dogToStringMap));

  // Due to contravariance in function parameters, this relationship is reversed
  console.log(
    "Animal->string map <: Dog->string map? (function contravariance)",
    checker.isSubtype(animalToStringMap, dogToStringMap),
  );
  console.log(
    "Dog->string map <: Animal->string map? (function contravariance)",
    checker.isSubtype(dogToStringMap, animalToStringMap),
  );
  console.log("");

  // Demo 8: Variant types (Sum types)
  console.log("=== 8. Variant Types ===");
  const result = examples.structural.result;
  console.log("Result<string, number>:", TypePrinter.print(result));

  // Create a more specific variant
  const errorResult = TypeFactory.variant({
    Ok: TypeFactory.number(),
    Error: TypeFactory.string(),
  });

  const networkErrorResult = TypeFactory.variant({
    Ok: TypeFactory.number(),
    Error: TypeFactory.string(),
    NetworkError: TypeFactory.string(),
    TimeoutError: TypeFactory.unit(),
  });

  console.log("Error result:", TypePrinter.print(errorResult));
  console.log("Network error result:", TypePrinter.print(networkErrorResult));
  console.log(
    "Network error result <: Error result?",
    checker.isSubtype(networkErrorResult, errorResult),
  );
  console.log("");

  // Demo 9: TypeScript-friendly syntax showcase
  console.log("=== 9. TypeScript Syntax Showcase ===");

  console.log(
    "🎯 Notice how all types are printed in familiar TypeScript syntax:",
  );
  console.log("");

  console.log(
    "• Functions use arrow syntax:",
    TypePrinter.print(
      TypeFactory.func([TypeFactory.string()], TypeFactory.number()),
    ),
  );
  console.log(
    "• Records use object syntax:",
    TypePrinter.print(
      TypeFactory.record({
        name: TypeFactory.string(),
        age: TypeFactory.number(),
      }),
    ),
  );
  console.log(
    "• Generics use <T> syntax:",
    TypePrinter.print(CommonTypes.list(TypeFactory.string())),
  );
  console.log(
    "• Options become nullable:",
    TypePrinter.print(CommonTypes.Some(TypeFactory.string())),
  );
  console.log(
    "• Arrays use Array<T>:",
    TypePrinter.print(CommonTypes.list(TypeFactory.number())),
  );
  console.log(
    "• Effects become interfaces:",
    TypePrinter.print(CommonTypes.IOEffect),
  );
  console.log("");

  console.log("✅ Type-checker demo completed!");
  console.log("\nFeatures demonstrated:");
  console.log("- ✅ Structural typing with width subtyping");
  console.log("- ✅ Higher-kinded types and type application");
  console.log("- ✅ ForAll types (universal quantification)");
  console.log("- ✅ Variance in type constructors");
  console.log("- ✅ Row types and polymorphism");
  console.log("- ✅ Effect types and handlers");
  console.log("- ✅ Complex polymorphic type instantiation");
  console.log("- ✅ Variant types with subtyping");
  console.log("- ✅ TypeScript-friendly syntax output");
}

// Run the demo
if (typeof window === "undefined") {
  runTypeCheckerDemo();
}
