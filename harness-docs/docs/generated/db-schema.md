# DB 스키마 (Supabase PostgreSQL)

> 이 문서는 코드에서 자동 생성/갱신된다.

## 테이블

### projects
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 프로젝트 고유 ID |
| name | text | 프로젝트 이름 |
| created_at | timestamptz | 생성일 |
| updated_at | timestamptz | 수정일 |

### fuel_cell_inputs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| project_id | uuid (FK→projects) | |
| set_index | int | 세트 순번 (0, 1, ...) |
| 형식 | text | 연료전지 형식 |
| 제조사 | text | |
| 모델명 | text | |
| 정격발전용량_kW | numeric | |
| 열생산용량_kW | numeric | |
| 가스소비량_kW | numeric | |
| kW당설치단가 | numeric | |
| kW당연간유지비용 | numeric | |
| 설치수량 | int | 사용자 입력 |

### operation_inputs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| project_id | uuid (FK→projects) | |
| 연간운전유형 | text | |
| 월별가동일 | jsonb | {1: 일수, 2: 일수, ...} |
| 일일_중간부하_운전시간 | numeric | 기본 18 |
| 일일_최대부하_운전시간 | numeric | 기본 6 |

### calculation_results
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| project_id | uuid (FK→projects) | |
| output_type | text | output1~output4 구분 |
| data | jsonb | 월별/연도별 계산 결과 |

### settings
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| key | text | 설정 키 (예: gemini_api_key) |
| value | text | 설정 값 |
