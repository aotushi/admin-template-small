import type { AdminDepartmentTreeItem } from "@/api/users";

export const ALL_DEPARTMENTS_KEY = "all";
const DEPARTMENT_KEY_PREFIX = "department:";

export function createDepartmentKey(id: number) {
  return `${DEPARTMENT_KEY_PREFIX}${id}`;
}

export function getSelectedDepartmentIds(
  departments: readonly AdminDepartmentTreeItem[],
  selectedKey: string,
): number[] | undefined {
  if (selectedKey === ALL_DEPARTMENTS_KEY) {
    return undefined;
  }

  const selectedId = Number(selectedKey.replace(DEPARTMENT_KEY_PREFIX, ""));
  if (!Number.isInteger(selectedId)) {
    return [];
  }

  const selectedDepartment = findDepartment(departments, selectedId);
  return selectedDepartment ? collectDepartmentIds(selectedDepartment) : [];
}

function findDepartment(
  departments: readonly AdminDepartmentTreeItem[],
  selectedId: number,
): AdminDepartmentTreeItem | undefined {
  for (const department of departments) {
    if (department.id === selectedId) {
      return department;
    }

    const child = findDepartment(department.children, selectedId);
    if (child) {
      return child;
    }
  }

  return undefined;
}

function collectDepartmentIds(department: AdminDepartmentTreeItem): number[] {
  return [department.id, ...department.children.flatMap(collectDepartmentIds)];
}
