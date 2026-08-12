/** Bundled ERD Studio sample catalog. Samples are templates, never the active workspace. */
(() => {
  'use strict';

  const clone = value => JSON.parse(JSON.stringify(value));

  const oracleHr = {
    tabName: '오라클 HR 인사',
    icon: 'fa-solid fa-users',
    title: '오라클 HR 표준 인사관리 스키마 (Oracle HR Standard Schema)',
    tables: [
      { name: 'REGIONS', desc: '대륙/지역 마스터 테이블', x: 60, y: 80, columns: [
        { name: 'REGION_ID', type: 'NUMBER', pk: true, fk: false },
        { name: 'REGION_NAME', type: 'VARCHAR2(25)', pk: false, fk: false }
      ] },
      { name: 'COUNTRIES', desc: '국가 정보 마스터', x: 580, y: 80, columns: [
        { name: 'COUNTRY_ID', type: 'CHAR(2)', pk: true, fk: false },
        { name: 'COUNTRY_NAME', type: 'VARCHAR2(40)', pk: false, fk: false },
        { name: 'REGION_ID', type: 'NUMBER', pk: false, fk: true }
      ] },
      { name: 'LOCATIONS', desc: '사업장/위치 정보 마스터', x: 1100, y: 80, columns: [
        { name: 'LOCATION_ID', type: 'NUMBER(4)', pk: true, fk: false },
        { name: 'STREET_ADDRESS', type: 'VARCHAR2(40)', pk: false, fk: false },
        { name: 'POSTAL_CODE', type: 'VARCHAR2(12)', pk: false, fk: false },
        { name: 'CITY', type: 'VARCHAR2(30)', pk: false, fk: false },
        { name: 'STATE_PROVINCE', type: 'VARCHAR2(25)', pk: false, fk: false },
        { name: 'COUNTRY_ID', type: 'CHAR(2)', pk: false, fk: true }
      ] },
      { name: 'DEPARTMENTS', desc: '부서 마스터', x: 1100, y: 480, columns: [
        { name: 'DEPARTMENT_ID', type: 'NUMBER(4)', pk: true, fk: false },
        { name: 'DEPARTMENT_NAME', type: 'VARCHAR2(30)', pk: false, fk: false },
        { name: 'MANAGER_ID', type: 'NUMBER(6)', pk: false, fk: true },
        { name: 'LOCATION_ID', type: 'NUMBER(4)', pk: false, fk: true }
      ] },
      { name: 'JOBS', desc: '직무/직책 마스터', x: 60, y: 480, columns: [
        { name: 'JOB_ID', type: 'VARCHAR2(10)', pk: true, fk: false },
        { name: 'JOB_TITLE', type: 'VARCHAR2(35)', pk: false, fk: false },
        { name: 'MIN_SALARY', type: 'NUMBER(6)', pk: false, fk: false },
        { name: 'MAX_SALARY', type: 'NUMBER(6)', pk: false, fk: false }
      ] },
      { name: 'EMPLOYEES', desc: '사원 마스터', x: 580, y: 480, columns: [
        { name: 'EMPLOYEE_ID', type: 'NUMBER(6)', pk: true, fk: false },
        { name: 'FIRST_NAME', type: 'VARCHAR2(20)', pk: false, fk: false },
        { name: 'LAST_NAME', type: 'VARCHAR2(25)', pk: false, fk: false },
        { name: 'EMAIL', type: 'VARCHAR2(25)', pk: false, fk: false },
        { name: 'PHONE_NUMBER', type: 'VARCHAR2(20)', pk: false, fk: false },
        { name: 'HIRE_DATE', type: 'DATE', pk: false, fk: false },
        { name: 'JOB_ID', type: 'VARCHAR2(10)', pk: false, fk: true },
        { name: 'SALARY', type: 'NUMBER(8,2)', pk: false, fk: false },
        { name: 'COMMISSION_PCT', type: 'NUMBER(2,2)', pk: false, fk: false },
        { name: 'MANAGER_ID', type: 'NUMBER(6)', pk: false, fk: true },
        { name: 'DEPARTMENT_ID', type: 'NUMBER(4)', pk: false, fk: true }
      ] },
      { name: 'JOB_HISTORY', desc: '사원 직무 이동 이력', x: 580, y: 920, columns: [
        { name: 'EMPLOYEE_ID', type: 'NUMBER(6)', pk: true, fk: true },
        { name: 'START_DATE', type: 'DATE', pk: true, fk: false },
        { name: 'END_DATE', type: 'DATE', pk: false, fk: false },
        { name: 'JOB_ID', type: 'VARCHAR2(10)', pk: false, fk: true },
        { name: 'DEPARTMENT_ID', type: 'NUMBER(4)', pk: false, fk: true }
      ] }
    ],
    relations: [
      { from: 'REGIONS', fromCol: 'REGION_ID', to: 'COUNTRIES', toCol: 'REGION_ID', identifying: true },
      { from: 'COUNTRIES', fromCol: 'COUNTRY_ID', to: 'LOCATIONS', toCol: 'COUNTRY_ID', identifying: true },
      { from: 'LOCATIONS', fromCol: 'LOCATION_ID', to: 'DEPARTMENTS', toCol: 'LOCATION_ID', identifying: false },
      { from: 'DEPARTMENTS', fromCol: 'DEPARTMENT_ID', to: 'EMPLOYEES', toCol: 'DEPARTMENT_ID', identifying: false },
      { from: 'JOBS', fromCol: 'JOB_ID', to: 'EMPLOYEES', toCol: 'JOB_ID', identifying: false },
      { from: 'EMPLOYEES', fromCol: 'EMPLOYEE_ID', to: 'JOB_HISTORY', toCol: 'EMPLOYEE_ID', identifying: true }
    ]
  };

  const oracleScott = {
    tabName: '오라클 SCOTT',
    icon: 'fa-solid fa-database',
    title: '오라클 전통 SCOTT/TIGER 샘플 스키마 (Oracle SCOTT Schema)',
    tables: [
      { name: 'DEPT', desc: '부서 마스터 테이블', x: 60, y: 80, columns: [
        { name: 'DEPTNO', type: 'NUMBER(2)', pk: true, fk: false },
        { name: 'DNAME', type: 'VARCHAR2(14)', pk: false, fk: false },
        { name: 'LOC', type: 'VARCHAR2(13)', pk: false, fk: false }
      ] },
      { name: 'EMP', desc: '사원 정보 마스터 테이블', x: 580, y: 80, columns: [
        { name: 'EMPNO', type: 'NUMBER(4)', pk: true, fk: false },
        { name: 'ENAME', type: 'VARCHAR2(10)', pk: false, fk: false },
        { name: 'JOB', type: 'VARCHAR2(9)', pk: false, fk: false },
        { name: 'MGR', type: 'NUMBER(4)', pk: false, fk: true },
        { name: 'HIREDATE', type: 'DATE', pk: false, fk: false },
        { name: 'SAL', type: 'NUMBER(7,2)', pk: false, fk: false },
        { name: 'COMM', type: 'NUMBER(7,2)', pk: false, fk: false },
        { name: 'DEPTNO', type: 'NUMBER(2)', pk: false, fk: true }
      ] },
      { name: 'SALGRADE', desc: '급여 등급 마스터 테이블', x: 1100, y: 80, columns: [
        { name: 'GRADE', type: 'NUMBER', pk: false, fk: false },
        { name: 'LOSAL', type: 'NUMBER', pk: false, fk: false },
        { name: 'HISAL', type: 'NUMBER', pk: false, fk: false }
      ] },
      { name: 'BONUS', desc: '사원 보너스 테이블', x: 580, y: 480, columns: [
        { name: 'ENAME', type: 'VARCHAR2(10)', pk: false, fk: false },
        { name: 'JOB', type: 'VARCHAR2(9)', pk: false, fk: false },
        { name: 'SAL', type: 'NUMBER', pk: false, fk: false },
        { name: 'COMM', type: 'NUMBER', pk: false, fk: false }
      ] }
    ],
    relations: [
      { from: 'DEPT', fromCol: 'DEPTNO', to: 'EMP', toCol: 'DEPTNO', identifying: false }
    ]
  };

  function performance300() {
    const tables = [];
    const relations = [];
    const colsPerRow = 20;
    for (let i = 0; i < 300; i += 1) {
      const n = String(i + 1).padStart(3, '0');
      const row = Math.floor(i / colsPerRow);
      const col = i % colsPerRow;
      const name = `PERF_TABLE_${n}`;
      tables.push({
        id: name, name, desc: `성능 테스트 테이블 ${n}`,
        x: 80 + col * 430, y: 80 + row * 390,
        columns: [
          { name: 'ID', type: 'NUMBER', pk: true, fk: false },
          { name: 'PARENT_ID', type: 'NUMBER', pk: false, fk: i > 0 },
          { name: 'CODE', type: 'VARCHAR2(30)', pk: false, fk: false },
          { name: 'NAME', type: 'VARCHAR2(100)', pk: false, fk: false },
          { name: 'STATUS', type: 'VARCHAR2(20)', pk: false, fk: false },
          { name: 'OWNER_ID', type: 'NUMBER', pk: false, fk: false },
          { name: 'AMOUNT', type: 'NUMBER(14,2)', pk: false, fk: false },
          { name: 'CREATED_AT', type: 'DATE', pk: false, fk: false },
          { name: 'UPDATED_AT', type: 'DATE', pk: false, fk: false },
          { name: 'REMARKS', type: 'VARCHAR2(500)', pk: false, fk: false }
        ]
      });
      if (i > 0) {
        relations.push({ from: `PERF_TABLE_${String(i).padStart(3, '0')}`, fromCol: 'ID', to: name, toCol: 'PARENT_ID', identifying: false });
      }
      if (i >= colsPerRow) {
        relations.push({ from: `PERF_TABLE_${String(i + 1 - colsPerRow).padStart(3, '0')}`, fromCol: 'ID', to: name, toCol: 'OWNER_ID', identifying: false });
      }
    }
    return {
      transient: true,
      tabName: '성능 300', icon: 'fa-solid fa-gauge-high',
      title: '대규모 ERD 성능 테스트 (300 Tables)', tables, relations
    };
  }

  const catalog = {
    oracle_hr: {
      id: 'oracle_hr', name: 'Oracle HR', description: 'Oracle 표준 HR 인사 스키마', dbms: 'oracle',
      schemaKey: 'oracle_hr', createSchema: () => clone(oracleHr)
    },
    oracle_scott: {
      id: 'oracle_scott', name: 'Oracle SCOTT', description: '전통 SCOTT/TIGER 예제 스키마', dbms: 'oracle',
      schemaKey: 'oracle_scott', createSchema: () => clone(oracleScott)
    },
    performance_300: {
      id: 'performance_300', name: 'Performance 300', description: '300 tables / 약 579 relations 렌더 성능 확인', dbms: 'oracle',
      schemaKey: 'performance_300', transient: true, createSchema: performance300
    }
  };

  window.ERDStudioSamples = {
    list: () => Object.values(catalog).map(item => ({
      id: item.id, name: item.name, description: item.description, dbms: item.dbms,
      schemaKey: item.schemaKey, transient: !!item.transient
    })),
    get: id => catalog[id] || null,
    create: id => {
      const item = catalog[id];
      if (!item) throw new Error(`Unknown sample: ${id}`);
      return item.createSchema();
    }
  };
})();