# BSS Magic Automated Test Suite

## Test Suite: Ontology Mapping

### TC-001: AI-Generated Initial Ontology Mapping
**Priority:** High  
**Type:** Integration  
**Component:** AI Mapping Engine

**Description:**  
Validate AI's ability to automatically generate mappings between customer data sources and TM Forum API, with emphasis on system documentation and API specifications rather than direct data access.

**Test Data:**
- Sample system documentation:
  - Totogi Charging API docs
  - CloudSense Salesforce API specs
  - STL system documentation
  - OneBill API documentation
  - LogiSense integration guide

**Prerequisites:**
1. Access to system documentation and API specifications
2. Authentication credentials for available APIs
3. Test environment configured
4. ETOM process documentation for alignment validation

**Test Steps:**
1. Process system documentation
   ```json
   {
     "source": "Totogi Charging",
     "documentation": {
       "api_specs": "/path/to/api/specs",
       "system_docs": "/path/to/system/docs",
       "etom_processes": ["1.2.3.4", "1.2.3.5"],
       "authentication": {
         "type": "OAuth2",
         "endpoint": "${AUTH_ENDPOINT}"
       }
     }
   }
   ```

2. Submit documentation for AI analysis
   ```json
   {
     "analysis_request": {
       "docs": {
         "api_specs": true,
         "system_docs": true,
         "etom_alignment": true
       },
       "goals": [
         "Map to TM Forum standards",
         "Align with ETOM processes",
         "Support ODA Canvas deployment"
       ]
     }
   }
   ```

3. Generate initial mapping
   ```json
   POST /api/v1/mapping/generate
   ```

4. Validate mapping against TMF standards
   ```json
   GET /api/v1/mapping/${mapping_id}/validate/tmf
   ```

**Expected Results:**
1. AI generates mapping without errors
2. Mapping includes all required TM Forum fields
3. Field types and transformations are correctly identified
4. ETOM process alignment validated
5. ODA Canvas deployment compatibility verified

**Validation Criteria:**
- [ ] Mapping successfully generated from documentation
- [ ] All required fields mapped
- [ ] Data types correctly matched
- [ ] ETOM process alignment confirmed
- [ ] ODA Canvas compatibility verified

---

### TC-002: AI-Assisted Mapping Refinement
**Priority:** High  
**Type:** Integration  
**Component:** Mapping Editor

**Description:**  
Verify user ability to refine AI-generated mappings with interactive assistance.

**Prerequisites:**
1. Completed AI-generated mapping from TC-001
2. Access to mapping editor UI
3. Test data for validation

**Test Steps:**
1. Load existing mapping
   ```json
   GET /api/v1/mapping/${mapping_id}
   ```

2. Modify field mapping
   ```json
   PATCH /api/v1/mapping/${mapping_id}/field
   {
     "source_field": "customer.firstName",
     "target_field": "Customer.givenName",
     "transformation": "string.concat(${firstName}, ' ', ${lastName})"
   }
   ```

3. Save modifications
   ```json
   PUT /api/v1/mapping/${mapping_id}
   ```

4. Run test transformation
   ```json
   POST /api/v1/mapping/${mapping_id}/test
   {
     "test_data": {
       "customer": {
         "firstName": "John",
         "lastName": "Doe"
       }
     }
   }
   ```

**Expected Results:**
1. Modifications saved successfully
2. AI respects user changes
3. Test transformation reflects updates
4. No unintended side effects

**Validation Criteria:**
- [ ] Changes persist after save
- [ ] AI suggestions don't override user changes
- [ ] Test data transforms correctly
- [ ] No regression in other mappings

---

### TC-003: AI-Driven Consistency Validation
**Priority:** High  
**Type:** System  
**Component:** Validation Engine

**Description:**  
Verify AI's ability to detect and flag mapping inconsistencies.

**Prerequisites:**
1. Mapping with known inconsistencies
2. Validation rules defined
3. Test environment configured

**Test Steps:**
1. Submit mapping for validation
   ```json
   POST /api/v1/mapping/${mapping_id}/validate
   ```

2. Review AI recommendations
   ```json
   GET /api/v1/mapping/${mapping_id}/recommendations
   ```

3. Apply corrections
   ```json
   PATCH /api/v1/mapping/${mapping_id}/corrections
   {
     "corrections": [
       {
         "field": "Customer.status",
         "issue": "type_mismatch",
         "correction": "string.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED'])"
       }
     ]
   }
   ```

4. Revalidate mapping
   ```json
   POST /api/v1/mapping/${mapping_id}/validate
   ```

**Expected Results:**
1. All inconsistencies identified
2. Clear correction recommendations
3. Successful application of fixes
4. Clean validation after corrections

**Validation Criteria:**
- [ ] All issues detected
- [ ] Recommendations are actionable
- [ ] Corrections apply successfully
- [ ] Final validation passes

---

### TC-004: Runtime Execution
**Priority:** Critical  
**Type:** System  
**Component:** Runtime Engine

**Description:**  
Validate runtime processing of TM Forum API requests using ontology mapping, with support for both cloud and on-premises deployment scenarios.

**Prerequisites:**
1. Validated ontology mapping
2. Accessible customer data sources
3. TM Forum conformance test suite
4. On-premises deployment configuration (if applicable)

**Test Steps:**
1. Deploy mapping to runtime
   ```json
   POST /api/v1/runtime/deploy
   {
     "mapping_id": "${mapping_id}",
     "version": "1.0.0",
     "deployment": {
       "type": "hybrid",
       "components": {
         "connector": {
           "location": "on-premises",
           "config": {
             "firewall_rules": "outbound-only",
             "authentication": {
               "type": "mutual-tls",
               "cert_path": "${CERT_PATH}"
             }
           }
         },
         "mapping_engine": {
           "location": "cloud",
           "oda_canvas_compatible": true
         }
       }
     }
   }
   ```

2. Execute TM Forum API requests
   ```bash
   # Create account with channel-specific logic
   curl -X POST "${API_BASE}/accountManagement/v5/partyAccount" \
       -H "Content-Type: application/json" \
       -H "X-Channel: online" \
       -d '{
         "name": "Test Account",
         "status": "ACTIVE",
         "channel": {
           "type": "online",
           "discounts": ["DIGITAL_FIRST"]
         }
       }'

   # Retrieve account with service layer context
   curl -X GET "${API_BASE}/accountManagement/v5/partyAccount/${id}" \
       -H "X-View-Type: technical" \
       -H "X-Service-Layer: CFS"

   # Update account with catalogue federation
   curl -X PATCH "${API_BASE}/catalogueManagement/v5/catalog/${id}" \
       -H "Content-Type: application/json" \
       -d '{
         "status": "PUBLISHED",
         "federation": {
           "commercial": true,
           "charging": true,
           "service": true
         }
       }'
   ```

3. Verify downstream system updates and service layer integrity
   ```json
   GET /api/v1/runtime/trace/${transaction_id}?include=service_layer
   ```

4. Run comprehensive TMF conformance tests
   ```bash
   # Run full TMF conformance suite
   npm run tmf-conformance-test -- --suite=full

   # Run ETOM process validation
   npm run etom-validation

   # Verify ODA Canvas compatibility
   npm run oda-canvas-verify
   ```

**Expected Results:**
1. Successful request translation
2. Correct response transformation
3. Accurate data mapping
4. Service layer integrity maintained
5. Channel-specific logic honored
6. Catalogue federation working
7. Passing TMF conformance tests
8. ETOM process alignment verified
9. ODA Canvas compatibility confirmed

**Validation Criteria:**
- [ ] Requests properly translated
- [ ] Responses correctly formatted
- [ ] Data integrity maintained
- [ ] Service layer logic respected
- [ ] Channel requirements honored
- [ ] Catalogue federation working
- [ ] TMF conformance passed
- [ ] ETOM alignment verified
- [ ] ODA Canvas compatible

---

## Test Execution

### Local Development
```bash
# Run all tests
npm run test:integration

# Run specific test case
npm run test:integration -- --test=TC-001

# Run with specific data source
npm run test:integration -- --source=Totogi
```

### CI/CD Pipeline
```yaml
test:
  stage: test
  script:
    - npm install
    - npm run test:integration
  artifacts:
    reports:
      junit: test-results.xml
```

### Test Results
Results will be available in:
1. JUnit XML format for CI/CD integration
2. HTML report for human readability
3. JSON format for programmatic analysis
4. TMF conformance certification reports
5. ETOM alignment reports
6. ODA Canvas compatibility reports

