import fs from "fs";
import path from "path";
import util from "util";

import { parse as parseTOML } from "toml";
import * as ts from "typescript";
import * as misc from "../../src/misc";
import ITree from "./tree";

interface IModuleConf {
    path: string;
    exclude: string[];
}

interface IConfig {
    outDir: string;
    modules: {[key in string]: IModuleConf};
}

const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
const readDir = util.promisify(fs.readdir);
const mkdir = util.promisify(fs.mkdir);

const cmtRe = /\/\*\*((\*(?!\/)|[^*])*)\*\//;

const complexNode = (n: ITree): boolean =>
    n.kind === "ClassDeclaration" || n.kind === "InterfaceDeclaration";

const nodeName = (node: ts.Node): string => {
    const nnode = node as ts.NamedDeclaration;
    if (!nnode.name) {
        return null;
    }
    const id = nnode.name as ts.Identifier;
    return id.escapedText ? `${id.escapedText}` : null;
};

function showNodes(ast: ts.Node, source: string, tree: ITree) {
    ts.forEachChild(ast, (node) => {
        if (node.kind === ts.SyntaxKind.ExportKeyword) { return; }
        const n: ITree = {kind: ts.SyntaxKind[node.kind]};
        const start = node.getFullStart();
        const end = start + node.getFullWidth();
        const decl = source.slice(start, end).trim();
        if (decl.slice(0, 3) === "/**") {
            const match = cmtRe.exec(decl);
            if (!match) { return; }
            n.comment = match[0];
        } else {
            return;
        }

        const nname = nodeName(node);
        if (nname !== null) {
            n.name = nname;
        }

        let re = /^(export\s+declare|export)?(.*)/gms;
        if (complexNode(n)) {
            re = /^(export\s+declare|export)?(.*)\{\s*\n/gms;
        }

        const d = decl.slice(n.comment.length).trim();
        let m = re.exec(d);
        if (m) {
            n.decl = m[2].trim();
        } else {
            n.decl = decl;
        }

        if (!n.name) {
            m = /^(const|let|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gms.exec(n.decl);
            if (m) {
                n.name = m[2].trim();
                n.keyword = m[1].trim();
            }
        }

        tree.children.push(n);
        if (complexNode(n)) {
            n.children = [];
            showNodes(node, source, n);
        }
    });
}

class Documenter {
    public async main() {
        if (process.argv.length < 3) {
            console.log("not enough parameters");
            process.exit(1);
        }

        const cfgText = await readFile(process.argv[2], { encoding: "utf8"});
        const cfg: IConfig = parseTOML(cfgText);

        const outPath = cfg.outDir.split("/");

        let p = "./";
        for (const name of outPath) {
            p = path.join(p, name);
            await new Promise<void>((resolve) => {
                fs.access(p, fs.constants.F_OK, (err) => {
                    if (err) { mkdir(p); }
                    resolve();
                });
            });
        }

        for (const modname in cfg.modules) {
            const modcfg = cfg.modules[modname];
            await this.genModuleDocs(modname, modcfg, cfg.outDir);
        }
    }

    private async genModuleDocs(modName: string, modCfg: IModuleConf, outDir: string) {
        const files = (await readDir(modCfg.path)).filter((name) =>
            /.*\.d\.ts$/.test(name) &&
            modCfg.exclude.indexOf(name.slice(0, -5)) < 0);
        const tree = {kind: "ModuleDeclaration", children: []};
        for (const fname of files) {
            const fpath = path.join(modCfg.path, fname);
            await this.genFileDoc(modName, fpath, tree);
        }

        const funcName = misc.makeAPIReferenceGetterName(modName);
        const code =
`module.exports = function ${funcName}() {
  return ${JSON.stringify(tree, null, 2)};
}
`;

        await writeFile(path.join(outDir, misc.makeAPIReferenceGetterName(modName) + ".js"),
            code, {flag: "w", encoding: "utf8"});
    }

    private async genFileDoc(modName: string, filePath: string, tree: ITree) {
        const code = await readFile(filePath, {encoding: "utf8"});
        const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.ES2015, true);
        showNodes(sourceFile, code, tree);
    }
}

new Documenter().main();
