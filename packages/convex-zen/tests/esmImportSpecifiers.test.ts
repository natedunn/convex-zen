import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(import.meta.dirname, "..");
const srcRoot = path.join(packageRoot, "src");

function collectSourceFiles(dir: string): string[] {
  return ts.sys
    .readDirectory(dir, [".ts", ".tsx"], undefined, undefined)
    .filter((filePath) => !filePath.includes(`${path.sep}_generated${path.sep}`));
}

function collectRelativeSpecifiers(sourceFile: ts.SourceFile): string[] {
  const specifiers: string[] = [];

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        specifiers.push(specifier);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

describe("esm import specifiers", () => {
  it("uses explicit .js extensions for relative imports and re-exports", async () => {
    const sourceFiles = collectSourceFiles(srcRoot);
    const violations: string[] = [];

    await Promise.all(
      sourceFiles.map(async (filePath) => {
        const source = await readFile(filePath, "utf8");
        const sourceFile = ts.createSourceFile(
          filePath,
          source,
          ts.ScriptTarget.Latest,
          true,
          filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        );

        for (const specifier of collectRelativeSpecifiers(sourceFile)) {
          if (!specifier.endsWith(".js")) {
            violations.push(
              `${path.relative(packageRoot, filePath)}: ${specifier}`
            );
          }
        }
      })
    );

    expect(violations).toEqual([]);
  });
});
