# Productive.io API Reference

## Base Configuration

- **Base URL:** `https://api.productive.io/api/v2/`
- **Format:** JSON:API (https://jsonapi.org/)
- **Content-Type:** `application/vnd.api+json`

## Authentication

Every request requires two headers:

```
X-Auth-Token: <PRODUCTIVE_API_KEY>
X-Organization-Id: <PRODUCTIVE_ORG_ID>
```

Load these from `.env` via `python-dotenv`. Never hardcode.

```python
headers = {
    "X-Auth-Token": os.getenv("PRODUCTIVE_API_KEY"),
    "X-Organization-Id": os.getenv("PRODUCTIVE_ORG_ID"),
    "Content-Type": "application/vnd.api+json",
}
```

## Rate Limits

- **100 requests per 10 seconds** per API token
- Implement exponential backoff on 429 responses
- Check `Retry-After` header when rate-limited
- Best practice: add 100ms delay between paginated requests

## Pagination

Productive uses **page-based pagination** (JSON:API style):

```
GET /api/v2/time_entries?page[number]=1&page[size]=200
```

- **Max page size:** 200 records
- Response includes pagination metadata:
  ```json
  {
    "meta": {
      "total_count": 1523,
      "page_count": 8
    }
  }
  ```
- Loop through all pages until `page[number]` > `page_count`

### Pagination pattern in Python:

```python
def fetch_all(endpoint, params=None):
    all_data = []
    all_included = []
    page = 1
    while True:
        p = {**(params or {}), "page[number]": page, "page[size]": 200}
        resp = requests.get(f"{BASE_URL}{endpoint}", headers=headers, params=p)
        resp.raise_for_status()
        body = resp.json()
        all_data.extend(body.get("data", []))
        all_included.extend(body.get("included", []))
        meta = body.get("meta", {})
        if page >= meta.get("page_count", 1):
            break
        page += 1
        time.sleep(0.1)  # respect rate limits
    return {"data": all_data, "included": all_included}
```

## Relevant Endpoints

### time_entries
Individual time tracking records. **This is our primary data source.**

```
GET /api/v2/time_entries
```

Key filters:
- `filter[after]=YYYY-MM-DD` — entries on or after date
- `filter[before]=YYYY-MM-DD` — entries on or before date
- `filter[person_id]=123` — filter by person
- `filter[project_id]=456` — filter by project
- `filter[service_id]=789` — filter by service type

Key includes (to resolve relationships in one call):
```
?include=person,service,project,project.company
```

Key attributes:
- `attributes.date` — the date of the entry
- `attributes.time` — minutes worked (integer)
- `attributes.note` — description text (can be null/empty — used for hygiene report)
- `attributes.billable` — boolean, whether this time is billable
- `relationships.person` — who logged it
- `relationships.service` — what type of work
- `relationships.project` — which project

### bookings
Future planned/scheduled time. Used for forecasting.

```
GET /api/v2/bookings
```

Key filters:
- `filter[after]=YYYY-MM-DD`
- `filter[before]=YYYY-MM-DD`
- `filter[person_id]=123`
- `filter[project_id]=456`

Key attributes:
- `attributes.started_on` — booking start date
- `attributes.ended_on` — booking end date
- `attributes.time` — total minutes booked
- `attributes.billable` — boolean
- `relationships.person`
- `relationships.project`
- `relationships.service`

### services
Service types (e.g., "Development", "Design", "Consulting").

```
GET /api/v2/services
```

Key attributes:
- `attributes.name` — service type name
- `attributes.pricing` — pricing type (hourly, fixed, etc.)

### projects
Projects, linked to companies (clients).

```
GET /api/v2/projects
```

Key filters:
- `filter[company_id]=123`
- `filter[project_type]=1` (1=time_and_materials, 2=fixed_price, 3=non_billable, 4=internal)

Key includes:
```
?include=company,budgets
```

Key attributes:
- `attributes.name`
- `attributes.project_type` — integer (see filter above)
- `attributes.budget_total` — total budget (cents)
- `relationships.company` — the client

### companies
Clients/organizations.

```
GET /api/v2/companies
```

Key attributes:
- `attributes.name` — company/client name

### people
Team members with cost/rate information.

```
GET /api/v2/people
```

Key attributes:
- `attributes.first_name`
- `attributes.last_name`
- `attributes.email`
- `attributes.role` — role in the organization
- `attributes.cost` — internal cost (if available, check with user)

### budgets
Project budgets with financial details.

```
GET /api/v2/budgets
```

Key includes:
```
?include=project,project.company
```

Key attributes:
- `attributes.name`
- `attributes.budget_total` — total budget in cents
- `attributes.billable_time` — total billable minutes logged
- `attributes.worked_time` — total minutes logged
- `attributes.revenue` — revenue amount in cents
- `attributes.cost` — cost amount in cents
- `relationships.project`

**Note on budgets:** While budgets contain pre-aggregated fields like `revenue` and `cost`, we use these ONLY for budget-vs-actual comparisons (overbudget detection). All other metrics are computed from raw time_entries.

### deals
Sales pipeline / opportunities.

```
GET /api/v2/deals
```

Key attributes:
- `attributes.name`
- `attributes.value` — deal value in cents
- `attributes.status` — deal status
- `relationships.company`

## Filter Syntax

Productive uses bracket notation for filters:

```
filter[field_name]=value
filter[after]=2026-01-01
filter[before]=2026-12-31
filter[person_id]=123,456    # comma-separated for multiple values
```

## Include Syntax (Sideloading)

Use `include` to sideload related resources and avoid N+1 queries:

```
?include=person,service,project
?include=project.company        # nested includes
?include=person,project,project.company,service
```

Included resources appear in the `included` array of the response. Match them via `relationships.*.data.id`.

## Response Structure (JSON:API)

```json
{
  "data": [
    {
      "id": "12345",
      "type": "time_entries",
      "attributes": {
        "date": "2026-03-15",
        "time": 480,
        "note": "Worked on feature X",
        "billable": true
      },
      "relationships": {
        "person": { "data": { "id": "67", "type": "people" } },
        "project": { "data": { "id": "89", "type": "projects" } },
        "service": { "data": { "id": "12", "type": "services" } }
      }
    }
  ],
  "included": [
    {
      "id": "67",
      "type": "people",
      "attributes": { "first_name": "Jan", "last_name": "Doe" }
    }
  ],
  "meta": {
    "total_count": 1523,
    "page_count": 8
  }
}
```
