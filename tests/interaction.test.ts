import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const interfaceFiles = [
  "app/platform.tsx",
  "app/compliance-ui.tsx",
  "app/legal-assistant-ui.tsx",
  "app/enterprise-operations.tsx",
];

test("every rendered button declares an action, type, or disabled state", () => {
  const misses: string[] = [];
  for (const file of interfaceFiles) {
    const source = fs.readFileSync(file, "utf8");
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const walk = (node: ts.Node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === "button") {
        const attributes = node.openingElement.attributes.properties
          .filter(ts.isJsxAttribute)
          .map((attribute) => attribute.name.getText(tree));
        if (!attributes.some((name) => ["onClick", "type", "disabled"].includes(name))) {
          const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
          misses.push(`${file}:${line}`);
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(tree);
  }
  assert.deepEqual(misses, []);
});

test("workflow handoffs stay inside the current persona and committee counts are dynamic", () => {
  const source = fs.readFileSync("app/platform.tsx", "utf8");
  assert.equal(source.includes('navigate(action === "committee" ? "/committee"'), false);
  assert.equal(source.includes('navigate(action === "manager" ? "/staff/inbox"'), false);
  assert.equal(source.includes("القضية ١ من ٩"), false);
  assert.match(source, /committeeCases\.length/);
  assert.match(source, /function GenericCommitteeMeeting/);
  assert.match(source, /status === "Manager Review"/);
  assert.match(source, /status === "Committee Review"/);
});

test("enterprise screens expose transactional contract instead of placeholder modules", () => {
  const source = fs.readFileSync("app/enterprise-operations.tsx", "utf8");
  assert.match(source, /TRANSACTION LIST/);
  assert.match(source, /createEnterpriseRecord/);
  assert.match(source, /transitionEnterpriseRecord/);
  assert.match(source, /مهامي واعتماداتي/);
  assert.match(source, /سجل الحركة والاعتماد/);
  assert.match(source, /مفتاح عدم الازدواج/);
  assert.doesNotMatch(source, /alert\s*\(/);
});

test("staff persona exposes a locked employee-level ERP workspace", () => {
  const platform = fs.readFileSync("app/platform.tsx", "utf8");
  const enterprise = fs.readFileSync("app/enterprise-operations.tsx", "utf8");
  assert.match(platform, /\/staff\/erp/);
  assert.match(platform, /بوابة الموظف المؤسسية/);
  assert.match(enterprise, /EMPLOYEE ENTERPRISE PORTAL/);
  assert.match(enterprise, /attendanceStatus/);
  assert.match(enterprise, /employeeProfile/);
  assert.match(enterprise, /const role: EnterpriseRoleId = employeeMode \? "general-employee"/);
  assert.doesNotMatch(enterprise, /employeeMode \? <RoleStrip/);
});

test("employee requests use service-specific forms and a manager handoff", () => {
  const platform = fs.readFileSync("app/platform.tsx", "utf8");
  const enterprise = fs.readFileSync("app/enterprise-operations.tsx", "utf8");
  assert.match(platform, /\/manager\/employee-requests/);
  assert.match(enterprise, /employeeRequestSchemas/);
  assert.match(enterprise, /خطة تسليم العمل والبديل/);
  assert.match(enterprise, /رقم الأصل \/ العهدة/);
  assert.match(enterprise, /الكلفة التقديرية — د\.ع/);
  assert.match(enterprise, /origin === "employee-portal"/);
  assert.match(enterprise, /mode === "manager"/);
});
