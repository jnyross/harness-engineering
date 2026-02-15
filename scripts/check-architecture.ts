import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

let failed = false;

function fail(msg: string) {
	console.error(`FAIL: ${msg}`);
	failed = true;
}

// 1. Lockstep versions — all packages must share the same version
const packagesDir = "packages";
const packageDirs = readdirSync(packagesDir).filter((d) =>
	existsSync(join(packagesDir, d, "package.json")),
);

const versions = new Map<string, string>();
for (const dir of packageDirs) {
	const pkg = JSON.parse(readFileSync(join(packagesDir, dir, "package.json"), "utf-8"));
	versions.set(pkg.name, pkg.version);
}

const uniqueVersions = new Set(versions.values());
if (uniqueVersions.size > 1) {
	fail("Version mismatch across packages:");
	for (const [name, version] of versions) {
		console.error(`  ${name}: ${version}`);
	}
}

// 2. Dependency hierarchy — no forbidden dependencies
const ALLOWED_INTERNAL_DEPS: Record<string, string[]> = {
	"@mariozechner/pi-ai": [],
	"@mariozechner/pi-tui": [],
	"@mariozechner/pi-agent-core": ["@mariozechner/pi-ai"],
	"@mariozechner/pi-coding-agent": [
		"@mariozechner/pi-agent-core",
		"@mariozechner/pi-ai",
		"@mariozechner/pi-tui",
	],
	"@mariozechner/pi-mom": [
		"@mariozechner/pi-agent-core",
		"@mariozechner/pi-ai",
		"@mariozechner/pi-coding-agent",
	],
	"@mariozechner/pi": ["@mariozechner/pi-agent-core"],
	"@mariozechner/pi-web-ui": ["@mariozechner/pi-ai", "@mariozechner/pi-tui"],
};

const internalPackages = new Set(versions.keys());

for (const dir of packageDirs) {
	const pkg = JSON.parse(readFileSync(join(packagesDir, dir, "package.json"), "utf-8"));
	const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
	const internalDeps = Object.keys(allDeps).filter((d) => internalPackages.has(d));
	const allowed = ALLOWED_INTERNAL_DEPS[pkg.name];

	if (!allowed) {
		fail(`${pkg.name} is not listed in ALLOWED_INTERNAL_DEPS — add it to check-architecture.ts`);
		continue;
	}

	for (const dep of internalDeps) {
		if (!allowed.includes(dep)) {
			fail(`${pkg.name} has forbidden dependency on ${dep}`);
		}
	}
}

// 3. Strict mode — all tsconfig.build.json must have strict: true
//    Either via extending tsconfig.base.json or set directly
for (const dir of packageDirs) {
	const tsconfigPath = join(packagesDir, dir, "tsconfig.build.json");
	if (!existsSync(tsconfigPath)) {
		fail(`${dir} missing tsconfig.build.json`);
		continue;
	}
	const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
	const extendsBase = tsconfig.extends?.includes("tsconfig.base.json");
	const hasStrictDirect = tsconfig.compilerOptions?.strict === true;
	if (!extendsBase && !hasStrictDirect) {
		fail(`${dir}/tsconfig.build.json must extend tsconfig.base.json or set strict: true`);
	}
	if (tsconfig.compilerOptions?.strict === false) {
		fail(`${dir}/tsconfig.build.json overrides strict to false`);
	}
}

if (failed) {
	process.exit(1);
} else {
	console.log("Architecture checks passed.");
}
