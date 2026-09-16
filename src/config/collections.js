export const BASE_API_URL = process.env.REACT_APP_API_URL || 'https://product-db-back.azurewebsites.net';

// List of columns managed by the server/database that should NOT be shown in forms or tables
export const EXCLUDED_INTERNAL_COLUMNS = ['created_at', 'created_by', 'updated_at', 'updated_by', 'password_hash', 'product_line_id'];

// Fields rendered as a searchable autocomplete (single-line input + live suggestions) instead of
// their default input. Only fields with a genuinely clean, authoritative source (KPI DB
// employees/customers) are listed here — design_center and manufacturing_locations stay free
// textareas, since real entries are narrative paragraphs, not one short pick.
export const FIELD_SUGGESTION_ENDPOINTS = {
    product_line_manager: '/api/kpi/people',
    customers_in_production: '/api/kpi/customers',
    customer_in_development: '/api/kpi/customers',
};

// --- Data Model Configuration based on PostgreSQL schema ---
export const initialCollections = {
    product_lines: {
        name: 'Product Lines',
        apiPath: '/api/product_lines',
        filters: [
            { key: 'name', label: 'Name', type: 'text-contains', fields: ['name'] },
            { key: 'product_line_manager', label: 'Manager', type: 'select', field: 'product_line_manager' },
        ],
        fields: ['id', 'name', 'type_of_products', 'manufacturing_locations', 'design_center', 'product_line_manager', 'history', 'type_of_customers', 'metiers', 'strength', 'weakness', 'perspectives', 'compliance_resource_id', 'attachments_raw', ...EXCLUDED_INTERNAL_COLUMNS],
        compactFields: [ 'name', 'product_line_manager'],
        requiredFields: ['name', 'product_line_manager' ],
        defaultValues: { name: '', type_of_products: '', product_line_manager: '', strength: '', weakness: '', attachments_raw: [] },
        placeholder: { name: 'Engine Line X', type_of_products: 'Automotive', product_line_manager: 'Jane Doe' },
        formSteps: [
            { title: 'Basics', fields: ['name', 'product_line_manager', 'design_center', 'manufacturing_locations'] },
            { title: 'Business', fields: ['type_of_products', 'type_of_customers', 'metiers', 'history'] },
            { title: 'Analysis', fields: ['strength', 'weakness', 'perspectives', 'compliance_resource_id'] },
            { title: 'Attachments', fields: ['attachments_raw'] },
        ],
    },
    products: {
        name: 'Products',
        apiPath: '/api/products',
        filters: [
            { key: 'product_name', label: 'Product Name', type: 'text-contains', fields: ['product_name'] },
            { key: 'product_line', label: 'Product Line', type: 'select', field: 'product_line' },
            { key: 'customer', label: 'Customer', type: 'text-contains', fields: ['customers_in_production', 'customer_in_development'] },
            { key: 'prod_if_customer_in_china', label: 'China Customer', type: 'boolean', field: 'prod_if_customer_in_china' },
            { key: 'gmdc_pct', label: 'GMDC %', type: 'range', field: 'gmdc_pct' },
        ],
        fields: ['id', 'product_name', 'product_line', 'description', 'product_definition', 'operating_environment', 'technical_parameters', 'machines_and_tooling', 'manufacturing_strategy', 'purchasing_strategy', 'prototypes_ppap_and_sop', 'engineering_and_testing', 'capacity', 'our_advantages', 'gmdc_pct', 'product_line_id', 'customers_in_production', 'customer_in_development', 'level_of_interest_and_why', 'estimated_price_per_product', 'prod_if_customer_in_china', 'costing_data', 'product_pictures', ...EXCLUDED_INTERNAL_COLUMNS],
        compactFields: [ 'product_name', 'product_line'],
        requiredFields: ['product_name', 'product_line'],
        defaultValues: { product_name: '', product_line: '', description: '', capacity: '', gmdc_pct: 0.00, product_pictures: [] },
        placeholder: { product_name: 'Sensor A1', product_line: 'Engine Line X', capacity: 'Unlimited/on demand...', gmdc_pct: 35.50 },
        formSteps: [
            { title: 'Basics', fields: ['product_name', 'product_line', 'description', 'capacity'] },
            { title: 'Technical', fields: ['product_definition', 'operating_environment', 'technical_parameters', 'machines_and_tooling'] },
            { title: 'Strategy', fields: ['manufacturing_strategy', 'purchasing_strategy', 'prototypes_ppap_and_sop', 'engineering_and_testing', 'our_advantages'] },
            { title: 'Commercial', fields: ['gmdc_pct', 'estimated_price_per_product', 'customers_in_production', 'customer_in_development', 'level_of_interest_and_why', 'prod_if_customer_in_china', 'costing_data'] },
            { title: 'Pictures', fields: ['product_pictures'] },
        ],
    },
    // Admin-only user management (role assignment)
    users: {
        name: 'Users',
        apiPath: '/api/users',
        filters: [
            { key: 'email', label: 'Email', type: 'text-contains', fields: ['email'] },
            { key: 'display_name', label: 'Name', type: 'text-contains', fields: ['display_name'] },
            { key: 'user_role', label: 'Role', type: 'select', field: 'user_role' },
        ],
        fields: ['id', 'email', 'display_name', 'user_role', ...EXCLUDED_INTERNAL_COLUMNS],
        compactFields: ['display_name', 'email', 'user_role'],
        requiredFields: [],
        defaultValues: { email: '', display_name: '', user_role: 'user' },
        placeholder: { email: 'name.lastname@avocarbon.com', display_name: 'Firstname Lastname' },
        editableFields: ['user_role'], // only role can be changed via PUT /api/users/:id
        fieldOptions: { user_role: ['user', 'admin'] },
    },
};

export const collectionKeys = Object.keys(initialCollections).filter(k => k !== 'users'); // Users tab is admin-only, added at runtime
export const LOGS_API_PATH = '/api/audit_logs';

// Initial column widths for resizing (used to initialize state)
const initialCompactFields = initialCollections.product_lines.compactFields.concat(initialCollections.products.compactFields).filter((v, i, a) => a.indexOf(v) === i);
export const initialColumnWidths = initialCompactFields.reduce((acc, field) => {
    acc[field] = 200; // Default width in pixels
    return acc;
}, {
    'id': 100,
    'Details': 120,
    // NEW: Default widths for audit log table columns
    'Action': 80,
    'User': 150,
    'Table': 150,
    'Record ID': 100,
    'Timestamp': 220,
});
