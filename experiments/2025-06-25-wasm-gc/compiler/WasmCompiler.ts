export interface WasmCompilationOptions {
  outputDir?: string;
  optimize?: boolean;
  debug?: boolean;
  target?: "wasm32-unknown-unknown" | "wasm32-wasi";
  features?: string[];
}

export interface WasmCompilationResult {
  success: boolean;
  wasmPath?: string;
  watPath?: string;
  witPath?: string;
  errors: string[];
  warnings: string[];
  size?: number;
}

export class WasmCompiler {
  private wasmToolsPath: string;

  constructor(wasmToolsPath?: string) {
    // Default to system wasm-tools, but allow override
    this.wasmToolsPath = wasmToolsPath || "wasm-tools";
  }

  async compile(
    watContent: string,
    witContent?: string,
    options: WasmCompilationOptions = {}
  ): Promise<WasmCompilationResult> {
    const result: WasmCompilationResult = {
      success: false,
      errors: [],
      warnings: [],
    };

    try {
      // Create output directory
      const outputDir = options.outputDir || "./wasm-output";
      await this.ensureDir(outputDir);

      // Generate unique filenames
      const timestamp = Date.now();
      const watPath = this.join(outputDir, `module-${timestamp}.wat`);
      const witPath = witContent ? this.join(outputDir, `module-${timestamp}.wit`) : undefined;
      const wasmPath = this.join(outputDir, `module-${timestamp}.wasm`);

      // Write WAT file
      await Deno.writeTextFile(watPath, watContent);
      result.watPath = watPath;

      // Validate WAT file
      const watValidation = await this.validateWat(watPath);
      if (!watValidation.valid) {
        result.errors.push(...watValidation.errors.map(e => `WAT validation error: ${e}`));
        return result;
      }

      // Write WIT file if provided
      if (witContent && witPath) {
        await Deno.writeTextFile(witPath, witContent);
        result.witPath = witPath;
        // Temporarily disable WIT validation to focus on WAT/WASM
        // const witValidation = await this.validateWit(witPath);
        // if (!witValidation.valid) {
        //   result.errors.push(...witValidation.errors.map(e => `WIT validation error: ${e}`));
        //   return result;
        // }
      }

      // Compile WAT to WASM
      const compileResult = await this.compileWatToWasm(watPath, wasmPath, options);
      
      if (compileResult.success) {
        result.success = true;
        result.wasmPath = wasmPath;
        
        // Validate WASM file
        const wasmValidation = await this.validateWasm(wasmPath);
        if (!wasmValidation.valid) {
          result.errors.push(...wasmValidation.errors.map(e => `WASM validation error: ${e}`));
          result.success = false;
        }

        // Get file size
        try {
          const stat = await Deno.stat(wasmPath);
          result.size = stat.size;
        } catch (e) {
          const error = e as Error;
          result.warnings.push(`Could not get file size: ${error.message}`);
        }
      } else {
        result.errors.push(...compileResult.errors);
      }

    } catch (error) {
      const err = error as Error;
      result.errors.push(`Compilation failed: ${err.message}`);
    }

    return result;
  }

  private async ensureDir(path: string): Promise<void> {
    try {
      await Deno.mkdir(path, { recursive: true });
    } catch (error) {
      const err = error as Error;
      if (!err.message.includes("already exists")) {
        throw error;
      }
    }
  }

  private join(...paths: string[]): string {
    return paths.join("/").replace(/\/+/g, "/");
  }

  private async compileWatToWasm(
    watPath: string,
    wasmPath: string,
    options: WasmCompilationOptions
  ): Promise<{ success: boolean; errors: string[] }> {
    const args = ["wat2wasm", watPath, "-o", wasmPath];

    // Only add supported flags
    // Note: --optimize is not supported by wat2wasm
    // Note: --target is not supported by wat2wasm
    // Note: --enable is not supported by wat2wasm

    // Add debug flags (this one is supported)
    if (options.debug) {
      args.push("--debug-names");
    }

    try {
      const command = new Deno.Command(this.wasmToolsPath, {
        args,
        stdout: "piped",
        stderr: "piped",
      });

      const { success, stdout, stderr } = await command.output();

      const errors: string[] = [];
      
      if (!success) {
        const stderrText = new TextDecoder().decode(stderr);
        errors.push(`wasm-tools compilation failed: ${stderrText}`);
      }

      // Check for warnings in stdout
      const stdoutText = new TextDecoder().decode(stdout);
      if (stdoutText.trim()) {
        // Parse warnings from stdout
        const lines = stdoutText.split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.includes('warning') || line.includes('Warning')) {
            errors.push(`Warning: ${line}`);
          }
        }
      }

      return { success, errors };
    } catch (error) {
      const err = error as Error;
      return {
        success: false,
        errors: [`Failed to execute wasm-tools: ${err.message}`],
      };
    }
  }

  async validateWasm(wasmPath: string): Promise<{ valid: boolean; errors: string[] }> {
    const args = ["validate", wasmPath];

    try {
      const command = new Deno.Command(this.wasmToolsPath, {
        args,
        stdout: "piped",
        stderr: "piped",
      });

      const { success, stderr } = await command.output();

      if (success) {
        return { valid: true, errors: [] };
      } else {
        const stderrText = new TextDecoder().decode(stderr);
        return { valid: false, errors: [stderrText] };
      }
    } catch (error) {
      const err = error as Error;
      return {
        valid: false,
        errors: [`Validation failed: ${err.message}`],
      };
    }
  }

  async getWasmInfo(wasmPath: string): Promise<{
    functions: number;
    globals: number;
    memories: number;
    tables: number;
    imports: number;
    exports: number;
    size: number;
  }> {
    const args = ["dump", wasmPath];

    try {
      const command = new Deno.Command(this.wasmToolsPath, {
        args,
        stdout: "piped",
        stderr: "piped",
      });

      const { success, stdout, stderr } = await command.output();

      if (!success) {
        const stderrText = new TextDecoder().decode(stderr);
        throw new Error(`Dump failed: ${stderrText}`);
      }

      const output = new TextDecoder().decode(stdout);
      
      // Parse the dump output
      const info = {
        functions: 0,
        globals: 0,
        memories: 0,
        tables: 0,
        imports: 0,
        exports: 0,
        size: 0,
      };

      // Simple parsing of wasm-tools dump output
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('functions:')) {
          const match = line.match(/(\d+)/);
          if (match) info.functions = parseInt(match[1]);
        } else if (line.includes('globals:')) {
          const match = line.match(/(\d+)/);
          if (match) info.globals = parseInt(match[1]);
        } else if (line.includes('memories:')) {
          const match = line.match(/(\d+)/);
          if (match) info.memories = parseInt(match[1]);
        } else if (line.includes('tables:')) {
          const match = line.match(/(\d+)/);
          if (match) info.tables = parseInt(match[1]);
        } else if (line.includes('imports:')) {
          const match = line.match(/(\d+)/);
          if (match) info.imports = parseInt(match[1]);
        } else if (line.includes('exports:')) {
          const match = line.match(/(\d+)/);
          if (match) info.exports = parseInt(match[1]);
        }
      }

      // Get file size
      try {
        const stat = await Deno.stat(wasmPath);
        info.size = stat.size;
      } catch {
        // Ignore size error
      }

      return info;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to get WASM info: ${err.message}`);
    }
  }

  async checkWasmTools(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const command = new Deno.Command(this.wasmToolsPath, {
        args: ["--version"],
        stdout: "piped",
        stderr: "piped",
      });

      const { success, stdout } = await command.output();

      if (success) {
        const version = new TextDecoder().decode(stdout).trim();
        return { available: true, version };
      } else {
        return { available: false, error: "wasm-tools command failed" };
      }
    } catch (error) {
      const err = error as Error;
      return { available: false, error: err.message };
    }
  }

  async validateWat(watPath: string): Promise<{ valid: boolean; errors: string[] }> {
    const args = ["parse", watPath];
    try {
      const command = new Deno.Command(this.wasmToolsPath, {
        args,
        stdout: "piped",
        stderr: "piped",
      });
      const { success, stderr } = await command.output();
      if (success) {
        return { valid: true, errors: [] };
      } else {
        const stderrText = new TextDecoder().decode(stderr);
        return { valid: false, errors: [stderrText] };
      }
    } catch (error) {
      const err = error as Error;
      return { valid: false, errors: [`WAT validation failed: ${err.message}`] };
    }
  }

  async validateWit(witPath: string): Promise<{ valid: boolean; errors: string[] }> {
    const args = ["component", "wit", witPath];
    try {
      const command = new Deno.Command(this.wasmToolsPath, {
        args,
        stdout: "piped",
        stderr: "piped",
      });
      const { success, stderr } = await command.output();
      if (success) {
        return { valid: true, errors: [] };
      } else {
        const stderrText = new TextDecoder().decode(stderr);
        return { valid: false, errors: [stderrText] };
      }
    } catch (error) {
      const err = error as Error;
      return { valid: false, errors: [`WIT validation failed: ${err.message}`] };
    }
  }
} 