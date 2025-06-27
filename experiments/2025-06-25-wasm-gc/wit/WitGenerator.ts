import { WitPackage, WitInterface, WitWorld, WitFunction, WitType, WitTypeKind } from "./types.ts";

export class WitGenerator {
  private indentLevel = 0;
  private lines: string[] = [];

  constructor(private pkg: WitPackage) {}

  generate(): string {
    this.lines = [];
    this.indentLevel = 0;
    
    this.writePackage();
    
    return this.lines.join("\n");
  }

  private writePackage(): void {
    this.writeLine(`package ${this.pkg.name};`);
    
    if (this.pkg.version) {
      this.writeLine(`version "${this.pkg.version}";`);
    }
    
    if (this.pkg.interfaces.length > 0 || this.pkg.worlds.length > 0) {
      this.writeLine("");
    }
    
    // Write interfaces
    for (let i = 0; i < this.pkg.interfaces.length; i++) {
      this.writeInterface(this.pkg.interfaces[i]);
      if (i < this.pkg.interfaces.length - 1 || this.pkg.worlds.length > 0) {
        this.writeLine("");
      }
    }
    
    // Write worlds
    for (let i = 0; i < this.pkg.worlds.length; i++) {
      this.writeWorld(this.pkg.worlds[i]);
      if (i < this.pkg.worlds.length - 1) {
        this.writeLine("");
      }
    }
  }

  private writeInterface(iface: WitInterface): void {
    this.writeLine(`interface ${iface.name} {`);
    this.indent();
    
    // Write types
    for (let i = 0; i < iface.types.length; i++) {
      this.writeType(iface.types[i]);
      if (i < iface.types.length - 1 || iface.functions.length > 0) {
        this.writeLine("");
      }
    }
    
    // Write functions
    for (let i = 0; i < iface.functions.length; i++) {
      this.writeFunction(iface.functions[i]);
      if (i < iface.functions.length - 1) {
        this.writeLine("");
      }
    }
    
    this.dedent();
    this.writeLine("}");
  }

  private writeType(type: WitType): void {
    this.writeLine(`type ${type.name} = ${this.typeKindToString(type.kind)};`);
  }

  private typeKindToString(kind: WitTypeKind): string {
    switch (kind.kind) {
      case "primitive":
        return kind.type;
      case "record":
        return `record { ${kind.fields.map(f => `${f.name}: ${this.typeRefToString(f.type)}`).join(", ")} }`;
      case "variant":
        return `variant { ${kind.cases.map(c => `${c.name}${c.type ? `(${this.typeRefToString(c.type)})` : ""}`).join(", ")} }`;
      case "enum":
        return `enum { ${kind.cases.join(", ")} }`;
      case "union":
        return `union { ${kind.types.map(t => this.typeRefToString(t)).join(", ")} }`;
      case "option":
        return `option<${this.typeRefToString(kind.type)}>`;
      case "result": {
        const ok = kind.ok ? this.typeRefToString(kind.ok) : "unit";
        const error = kind.error ? this.typeRefToString(kind.error) : "unit";
        return `result<${ok}, ${error}>`;
      }
      case "list":
        return `list<${this.typeRefToString(kind.type)}>`;
      default:
        return "unknown";
    }
  }

  private typeRefToString(ref: string | { name: string; package?: string }): string {
    if (typeof ref === "string") {
      return ref;
    }
    return ref.package ? `${ref.package}/${ref.name}` : ref.name;
  }

  private writeFunction(func: WitFunction): void {
    const params = func.params.map(p => `${p.name}: ${this.typeRefToString(p.type)}`).join(", ");
    const results = func.results.length === 0 ? "" : 
      func.results.length === 1 ? 
        ` -> ${this.typeRefToString(func.results[0].type)}` :
        ` -> (${func.results.map(r => this.typeRefToString(r.type)).join(", ")})`;
    
    this.writeLine(`${func.name}(${params})${results};`);
  }

  private writeWorld(world: WitWorld): void {
    this.writeLine(`world ${world.name} {`);
    this.indent();
    
    // Write imports
    if (world.imports.length > 0) {
      this.writeLine("import {");
      this.indent();
      for (const imp of world.imports) {
        const alias = imp.alias ? ` as ${imp.alias}` : "";
        this.writeLine(`${imp.interface}${alias},`);
      }
      this.dedent();
      this.writeLine("};");
      if (world.exports.length > 0) {
        this.writeLine("");
      }
    }
    
    // Write exports
    if (world.exports.length > 0) {
      this.writeLine("export {");
      this.indent();
      for (const exp of world.exports) {
        const alias = exp.alias ? ` as ${exp.alias}` : "";
        this.writeLine(`${exp.interface}${alias},`);
      }
      this.dedent();
      this.writeLine("};");
    }
    
    this.dedent();
    this.writeLine("}");
  }

  private writeLine(line: string): void {
    const indent = "  ".repeat(this.indentLevel);
    this.lines.push(indent + line);
  }

  private indent(): void {
    this.indentLevel++;
  }

  private dedent(): void {
    this.indentLevel--;
  }
} 