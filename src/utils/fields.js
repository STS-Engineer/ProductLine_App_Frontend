// Display-only tag stripping for showing rich-text field values as plain text (e.g. in a
// truncated table cell) — not a security sanitizer, just formatting.
export const stripHtml = (html) => {
    if (!html) return '';
    return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

export const formatTimestamp = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString();
    } catch (e) {
        return 'Invalid Date';
    }
};

export const getFieldType = (field) => {
    if (field.includes('history') || field.includes('description') || field.includes('strategy')|| field.includes('capacity') || field.includes('parameters') || field.includes('tooling') || field.includes('advantages') || field.includes('costing_data') || field.includes('definition') || field.includes('environment') || field.includes('locations') || field.includes('center') || field.includes('metiers') || field.includes('strength') || field.includes('weakness') || field.includes('perspectives') || field.includes('customers') || field.includes('prototypes_ppap_and_sop') || field.includes('engineering_and_testing') || field.includes('type_of_products') || field.includes('level_of_interest_and_why')) return 'textarea';
    if (field.includes('gmdc_pct') || field.includes('estimated_price') ) return 'number';
    if (field.includes('prod_if_customer_in_china')) return 'checkbox';
    // File/Image fields now map to the new file handling logic
    if (field.includes('product_pictures')) return 'file_image';
    if (field.includes('attachments_raw')) return 'file_attachment';

    return 'text';
};
