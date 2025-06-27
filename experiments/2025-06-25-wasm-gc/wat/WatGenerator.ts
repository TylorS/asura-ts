import * as types from "./types.ts";

export class WatGenerator {
  private indentLevel = 0;
  private lines: string[] = [];

  constructor(private module: types.WatModule) {}

  generate(): string {
    this.lines = [];
    this.indentLevel = 0;
    
    this.writeModule();
    
    return this.lines.join("\n");
  }

  private writeModule(): void {
    this.writeLine("(module");
    this.indent();
    
    if (this.module.name) {
      this.writeLine(`(name "${this.module.name}")`);
    }
    
    // Write imports
    for (const imp of this.module.imports) {
      this.writeImport(imp);
    }
    
    // Write memories
    for (const memory of this.module.memories) {
      this.writeMemory(memory);
    }
    
    // Write tables
    for (const table of this.module.tables) {
      this.writeTable(table);
    }
    
    // Write globals
    for (const global of this.module.globals) {
      this.writeGlobal(global);
    }
    
    // Write functions
    for (const func of this.module.functions) {
      this.writeFunction(func);
    }
    
    // Write exports
    for (const exp of this.module.exports) {
      this.writeExport(exp);
    }
    
    this.dedent();
    if (this.lines.length === 1) {
      this.lines[0] += ")";
    } else {
      this.writeLine(")");
    }
  }

  private writeImport(imp: types.WatImport): void {
    this.writeLine(`(import "${imp.module}" "${imp.name}" (${imp.kind}${imp.type ? ` ${imp.type}` : ""}))`);
  }

  private writeMemory(memory: types.WatMemory): void {
    const name = memory.name ? `(name "${memory.name}")` : "";
    const max = memory.max ? ` ${memory.max}` : "";
    this.writeLine(`(memory ${name} ${memory.min}${max})`);
  }

  private writeTable(table: types.WatTable): void {
    const name = table.name ? `(name "${table.name}")` : "";
    const max = table.max ? ` ${table.max}` : "";
    this.writeLine(`(table ${name} ${table.min}${max} ${table.elementType})`);
  }

  private writeGlobal(global: types.WatGlobal): void {
    const name = global.name ? `(name "${global.name}")` : "";
    const mut = global.mutable ? " (mut " : " (";
    this.writeLine(`(global ${name}${mut}${global.type}))`);
    // TODO: Add init expression
  }

  private writeFunction(func: types.WatFunction): void {
    this.writeLine("(func");
    this.indent();
    
    if (func.name) {
      this.writeLine(`(name "${func.name}")`);
    }
    
    // Write parameters
    if (func.params.length > 0) {
      this.writeLine("(param");
      this.indent();
      for (const param of func.params) {
        const name = param.name ? `"${param.name}" ` : "";
        this.writeLine(`${name}${param.type}`);
      }
      this.dedent();
      this.writeLine(")");
    }
    
    // Write results
    if (func.results.length > 0) {
      this.writeLine("(result");
      this.indent();
      for (const result of func.results) {
        this.writeLine(result);
      }
      this.dedent();
      this.writeLine(")");
    }
    
    // Write locals
    if (func.locals.length > 0) {
      this.writeLine("(local");
      this.indent();
      for (const local of func.locals) {
        const name = local.name ? `"${local.name}" ` : "";
        this.writeLine(`${name}${local.type}`);
      }
      this.dedent();
      this.writeLine(")");
    }
    
    // Write body
    if (func.body.length > 0) {
      for (const instruction of func.body) {
        this.writeInstruction(instruction);
      }
    }
    
    this.dedent();
    this.writeLine(")");
  }

  private writeInstruction(instruction: { opcode: string; operands?: (string | number)[] }): void {
    const operands = instruction.operands?.join(" ") || "";
    this.writeLine(`${instruction.opcode}${operands ? ` ${operands}` : ""}`);
  }

  private writeExport(exp: types.WatExport): void {
    this.writeLine(`(export "${exp.name}" (${exp.kind} ${exp.index}))`);
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