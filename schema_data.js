/**
 * Oracle Standard Sample ERD Schema Data Store (Oracle HR & SCOTT Schema)
 * Completely domain-free sample ERD for Oracle DB standard schemas.
 * (v0.0.3 Robust Architecture: optional id, auto layout, composite keys & tab metadata)
 */
const schemaData = {
    oracle_hr: {
        tabName: "오라클 HR 인사",
        icon: "fa-solid fa-users",
        title: "오라클 HR 표준 인사관리 스키마 (Oracle HR Standard Schema)",
        tables: [
            {
                name: "REGIONS",
                desc: "대륙/지역 마스터 테이블",
                x: 60, y: 80,
                columns: [
                    { name: "REGION_ID", type: "NUMBER", pk: true, fk: false },
                    { name: "REGION_NAME", type: "VARCHAR2(25)", pk: false, fk: false }
                ]
            },
            {
                name: "COUNTRIES",
                desc: "국가 정보 마스터",
                x: 580, y: 80,
                columns: [
                    { name: "COUNTRY_ID", type: "CHAR(2)", pk: true, fk: false },
                    { name: "COUNTRY_NAME", type: "VARCHAR2(40)", pk: false, fk: false },
                    { name: "REGION_ID", type: "NUMBER", pk: false, fk: true }
                ]
            },
            {
                name: "LOCATIONS",
                desc: "사업장/위치 정보 마스터",
                x: 1100, y: 80,
                columns: [
                    { name: "LOCATION_ID", type: "NUMBER(4)", pk: true, fk: false },
                    { name: "STREET_ADDRESS", type: "VARCHAR2(40)", pk: false, fk: false },
                    { name: "POSTAL_CODE", type: "VARCHAR2(12)", pk: false, fk: false },
                    { name: "CITY", type: "VARCHAR2(30)", pk: false, fk: false },
                    { name: "STATE_PROVINCE", type: "VARCHAR2(25)", pk: false, fk: false },
                    { name: "COUNTRY_ID", type: "CHAR(2)", pk: false, fk: true }
                ]
            },
            {
                name: "DEPARTMENTS",
                desc: "부서 마스터",
                x: 1100, y: 480,
                columns: [
                    { name: "DEPARTMENT_ID", type: "NUMBER(4)", pk: true, fk: false },
                    { name: "DEPARTMENT_NAME", type: "VARCHAR2(30)", pk: false, fk: false },
                    { name: "MANAGER_ID", type: "NUMBER(6)", pk: false, fk: true },
                    { name: "LOCATION_ID", type: "NUMBER(4)", pk: false, fk: true }
                ]
            },
            {
                name: "JOBS",
                desc: "직무/직책 마스터",
                x: 60, y: 480,
                columns: [
                    { name: "JOB_ID", type: "VARCHAR2(10)", pk: true, fk: false },
                    { name: "JOB_TITLE", type: "VARCHAR2(35)", pk: false, fk: false },
                    { name: "MIN_SALARY", type: "NUMBER(6)", pk: false, fk: false },
                    { name: "MAX_SALARY", type: "NUMBER(6)", pk: false, fk: false }
                ]
            },
            {
                name: "EMPLOYEES",
                desc: "사원 마스터",
                x: 580, y: 480,
                columns: [
                    { name: "EMPLOYEE_ID", type: "NUMBER(6)", pk: true, fk: false },
                    { name: "FIRST_NAME", type: "VARCHAR2(20)", pk: false, fk: false },
                    { name: "LAST_NAME", type: "VARCHAR2(25)", pk: false, fk: false },
                    { name: "EMAIL", type: "VARCHAR2(25)", pk: false, fk: false },
                    { name: "PHONE_NUMBER", type: "VARCHAR2(20)", pk: false, fk: false },
                    { name: "HIRE_DATE", type: "DATE", pk: false, fk: false },
                    { name: "JOB_ID", type: "VARCHAR2(10)", pk: false, fk: true },
                    { name: "SALARY", type: "NUMBER(8,2)", pk: false, fk: false },
                    { name: "COMMISSION_PCT", type: "NUMBER(2,2)", pk: false, fk: false },
                    { name: "MANAGER_ID", type: "NUMBER(6)", pk: false, fk: true },
                    { name: "DEPARTMENT_ID", type: "NUMBER(4)", pk: false, fk: true }
                ]
            },
            {
                name: "JOB_HISTORY",
                desc: "사원 직무 이동 이력",
                x: 580, y: 920,
                columns: [
                    { name: "EMPLOYEE_ID", type: "NUMBER(6)", pk: true, fk: true },
                    { name: "START_DATE", type: "DATE", pk: true, fk: false },
                    { name: "END_DATE", type: "DATE", pk: false, fk: false },
                    { name: "JOB_ID", type: "VARCHAR2(10)", pk: false, fk: true },
                    { name: "DEPARTMENT_ID", type: "NUMBER(4)", pk: false, fk: true }
                ]
            }
        ],
        relations: [
            { from: "REGIONS", fromCol: "REGION_ID", to: "COUNTRIES", toCol: "REGION_ID", identifying: true },
            { from: "COUNTRIES", fromCol: "COUNTRY_ID", to: "LOCATIONS", toCol: "COUNTRY_ID", identifying: true },
            { from: "LOCATIONS", fromCol: "LOCATION_ID", to: "DEPARTMENTS", toCol: "LOCATION_ID", identifying: false },
            { from: "DEPARTMENTS", fromCol: "DEPARTMENT_ID", to: "EMPLOYEES", toCol: "DEPARTMENT_ID", identifying: false },
            { from: "JOBS", fromCol: "JOB_ID", to: "EMPLOYEES", toCol: "JOB_ID", identifying: false },
            { from: "EMPLOYEES", fromCol: "EMPLOYEE_ID", to: "JOB_HISTORY", toCol: "EMPLOYEE_ID", identifying: true }
        ]
    },
    oracle_scott: {
        tabName: "오라클 SCOTT",
        icon: "fa-solid fa-database",
        title: "오라클 전통 SCOTT/TIGER 샘플 스키마 (Oracle SCOTT Schema)",
        tables: [
            {
                name: "DEPT",
                desc: "부서 마스터 테이블",
                x: 60, y: 80,
                columns: [
                    { name: "DEPTNO", type: "NUMBER(2)", pk: true, fk: false },
                    { name: "DNAME", type: "VARCHAR2(14)", pk: false, fk: false },
                    { name: "LOC", type: "VARCHAR2(13)", pk: false, fk: false }
                ]
            },
            {
                name: "EMP",
                desc: "사원 정보 마스터 테이블",
                x: 580, y: 80,
                columns: [
                    { name: "EMPNO", type: "NUMBER(4)", pk: true, fk: false },
                    { name: "ENAME", type: "VARCHAR2(10)", pk: false, fk: false },
                    { name: "JOB", type: "VARCHAR2(9)", pk: false, fk: false },
                    { name: "MGR", type: "NUMBER(4)", pk: false, fk: true },
                    { name: "HIREDATE", type: "DATE", pk: false, fk: false },
                    { name: "SAL", type: "NUMBER(7,2)", pk: false, fk: false },
                    { name: "COMM", type: "NUMBER(7,2)", pk: false, fk: false },
                    { name: "DEPTNO", type: "NUMBER(2)", pk: false, fk: true }
                ]
            },
            {
                name: "SALGRADE",
                desc: "급여 등급 마스터 테이블",
                x: 1100, y: 80,
                columns: [
                    { name: "GRADE", type: "NUMBER", pk: false, fk: false },
                    { name: "LOSAL", type: "NUMBER", pk: false, fk: false },
                    { name: "HISAL", type: "NUMBER", pk: false, fk: false }
                ]
            },
            {
                name: "BONUS",
                desc: "사원 보너스 테이블",
                x: 580, y: 480,
                columns: [
                    { name: "ENAME", type: "VARCHAR2(10)", pk: false, fk: false },
                    { name: "JOB", type: "VARCHAR2(9)", pk: false, fk: false },
                    { name: "SAL", type: "NUMBER", pk: false, fk: false },
                    { name: "COMM", type: "NUMBER", pk: false, fk: false }
                ]
            }
        ],
        relations: [
            { from: "DEPT", fromCol: "DEPTNO", to: "EMP", toCol: "DEPTNO", identifying: false }
        ]
    }
};
