-- TMF Party Management API endpoints
INSERT INTO public.bss_endpoints (path, method, version, description, parameters, responses, required_fields)
VALUES
  -- Party Account endpoints
  ('/partyManagement/v4/partyAccount', 'GET', '4', 'List party accounts', 
   '{"limit": "integer", "offset": "integer"}',
   '{"type": "array", "items": {"$ref": "#/definitions/PartyAccount"}}',
   ARRAY['id', 'name', 'accountType']),
   
  ('/partyManagement/v4/partyAccount/{id}', 'GET', '4', 'Retrieve a party account', 
   '{"id": "string"}',
   '{"$ref": "#/definitions/PartyAccount"}',
   ARRAY['id', 'name', 'accountType']),
   
  ('/partyManagement/v4/partyAccount', 'POST', '4', 'Create a party account', 
   null,
   '{"$ref": "#/definitions/PartyAccount"}',
   ARRAY['name', 'accountType']),
   
  ('/partyManagement/v4/partyAccount/{id}', 'PATCH', '4', 'Update a party account', 
   '{"id": "string"}',
   '{"$ref": "#/definitions/PartyAccount"}',
   ARRAY['id']),

  -- Individual endpoints
  ('/partyManagement/v4/individual', 'GET', '4', 'List individuals', 
   '{"limit": "integer", "offset": "integer"}',
   '{"type": "array", "items": {"$ref": "#/definitions/Individual"}}',
   ARRAY['id', 'givenName', 'familyName']),
   
  ('/partyManagement/v4/individual/{id}', 'GET', '4', 'Retrieve an individual', 
   '{"id": "string"}',
   '{"$ref": "#/definitions/Individual"}',
   ARRAY['id', 'givenName', 'familyName']),
   
  ('/partyManagement/v4/individual', 'POST', '4', 'Create an individual', 
   null,
   '{"$ref": "#/definitions/Individual"}',
   ARRAY['givenName', 'familyName']),

  -- Organization endpoints
  ('/partyManagement/v4/organization', 'GET', '4', 'List organizations', 
   '{"limit": "integer", "offset": "integer"}',
   '{"type": "array", "items": {"$ref": "#/definitions/Organization"}}',
   ARRAY['id', 'tradingName']),
   
  ('/partyManagement/v4/organization/{id}', 'GET', '4', 'Retrieve an organization', 
   '{"id": "string"}',
   '{"$ref": "#/definitions/Organization"}',
   ARRAY['id', 'tradingName']),

-- TMF Account Management API endpoints
  ('/accountManagement/v4/account', 'GET', '4', 'List accounts', 
   '{"limit": "integer", "offset": "integer"}',
   '{"type": "array", "items": {"$ref": "#/definitions/Account"}}',
   ARRAY['id', 'name', 'accountType']),
   
  ('/accountManagement/v4/account/{id}', 'GET', '4', 'Retrieve an account', 
   '{"id": "string"}',
   '{"$ref": "#/definitions/Account"}',
   ARRAY['id', 'name', 'accountType']),
   
  ('/accountManagement/v4/account', 'POST', '4', 'Create an account', 
   null,
   '{"$ref": "#/definitions/Account"}',
   ARRAY['name', 'accountType']),
   
  ('/accountManagement/v4/account/{id}', 'PATCH', '4', 'Update an account', 
   '{"id": "string"}',
   '{"$ref": "#/definitions/Account"}',
   ARRAY['id']),

  -- Bill Management endpoints
  ('/accountManagement/v4/billFormat', 'GET', '4', 'List bill formats', 
   '{"limit": "integer", "offset": "integer"}',
   '{"type": "array", "items": {"$ref": "#/definitions/BillFormat"}}',
   ARRAY['id', 'name']),
   
  ('/accountManagement/v4/billFormat/{id}', 'GET', '4', 'Retrieve a bill format', 
   '{"id": "string"}',
   '{"$ref": "#/definitions/BillFormat"}',
   ARRAY['id', 'name']),

  -- Payment Management endpoints
  ('/accountManagement/v4/paymentMethod', 'GET', '4', 'List payment methods', 
   '{"limit": "integer", "offset": "integer"}',
   '{"type": "array", "items": {"$ref": "#/definitions/PaymentMethod"}}',
   ARRAY['id', 'name', 'type']),
   
  ('/accountManagement/v4/paymentMethod/{id}', 'GET', '4', 'Retrieve a payment method', 
   '{"id": "string"}',
   '{"$ref": "#/definitions/PaymentMethod"}',
   ARRAY['id', 'name', 'type']),
   
  ('/accountManagement/v4/paymentMethod', 'POST', '4', 'Create a payment method', 
   null,
   '{"$ref": "#/definitions/PaymentMethod"}',
   ARRAY['name', 'type']);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS bss_endpoints_version_idx ON public.bss_endpoints (version);
CREATE INDEX IF NOT EXISTS bss_endpoints_method_idx ON public.bss_endpoints (method); 