import { ChevronDown } from 'lucide-react';
import RichTextInput from './RichTextInput';
import SearchableSelect from './SearchableSelect';

const INPUT_CLASS = "p-3 border border-[#C7C7C7] rounded-lg focus:ring-2 focus:ring-[#0071B8] focus:border-[#0071B8] shadow-sm w-full transition-colors duration-150";

// Shared field renderer used by both the "add new" form and the edit modal. The two forms
// differ slightly in a few spots (checkbox/textarea wrapper classes, placeholder) — those are
// the only bits left as props; everything else (which input to render for which field type,
// value/onChange wiring) lives here once.
const FieldInput = ({
    field, label, type, isRequired,
    value, onChange, disabled,
    placeholder,
    idPrefix = 'field',
    fieldOptions,
    productLineOptions,
    suggestionEndpoint,
    authToken,
    textareaContainerClassName = "relative flex flex-col col-span-full",
    checkboxContainerClassName = "flex items-center space-x-2 p-2 col-span-full",
}) => {
    const currentValue = value ?? '';

    const inputId = `${idPrefix}-${field}`;

    // Sourced from a live lookup (KPI DB, or this app's own past entries) instead of a hardcoded
    // option list — takes precedence over the field's own type (e.g. a field that would
    // otherwise render as a rich-text textarea).
    if (suggestionEndpoint) {
        return (
            <div className="relative flex flex-col">
                <label htmlFor={inputId} className="text-xs font-medium text-[#575757] mb-1">{label} {isRequired && '*'}</label>
                <SearchableSelect
                    id={inputId}
                    endpoint={suggestionEndpoint}
                    authToken={authToken}
                    value={currentValue}
                    onChange={onChange}
                    disabled={disabled}
                    placeholder={placeholder}
                />
            </div>
        );
    }

    if (productLineOptions) {
        return (
            <div className="relative flex flex-col">
                <label htmlFor={inputId} className="text-xs font-medium text-[#575757] mb-1">{label} {isRequired && '*'}</label>
                <select
                    id={inputId}
                    value={currentValue}
                    onChange={(e) => onChange(e.target.value)}
                    required={isRequired}
                    className={`${INPUT_CLASS} appearance-none pr-8`}
                    disabled={disabled}
                >
                    <option value="" disabled>-- Select a Product Line --</option>
                    {productLineOptions.map(pl => (
                        <option key={pl.id} value={pl.name}>{pl.name}</option>
                    ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#575757] absolute right-3 bottom-3 pointer-events-none" />
            </div>
        );
    }

    if (type === 'textarea') {
        return (
            <RichTextInput
                field={field}
                label={label}
                isRequired={isRequired}
                value={currentValue}
                onChange={onChange}
                disabled={disabled}
                idPrefix={idPrefix}
                placeholder={placeholder}
                containerClassName={textareaContainerClassName}
            />
        );
    }

    if (type === 'checkbox') {
        return (
            <div className={checkboxContainerClassName}>
                <input
                    type="checkbox"
                    id={inputId}
                    checked={!!currentValue}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-5 w-5 text-[#0071B8] border-[#C7C7C7] rounded focus:ring-[#0071B8]"
                    disabled={disabled}
                />
                <label htmlFor={inputId} className="text-sm font-medium text-[#575757]">{label}</label>
            </div>
        );
    }

    if (fieldOptions) {
        return (
            <div className="relative flex flex-col">
                <label htmlFor={inputId} className="text-xs font-medium text-[#575757] mb-1">{label} {isRequired && '*'}</label>
                <select
                    id={inputId}
                    value={currentValue}
                    onChange={(e) => onChange(e.target.value)}
                    required={isRequired}
                    className={`${INPUT_CLASS} appearance-none pr-8`}
                    disabled={disabled}
                >
                    {fieldOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#575757] absolute right-3 bottom-3 pointer-events-none" />
            </div>
        );
    }

    return (
        <div className="relative flex flex-col">
            <label htmlFor={inputId} className="text-xs font-medium text-[#575757] mb-1">{label} {isRequired && '*'}</label>
            <input
                id={inputId}
                type={type}
                step={type === 'number' ? '0.01' : 'any'}
                placeholder={placeholder}
                value={currentValue}
                onChange={(e) => onChange(e.target.value)}
                required={isRequired}
                className={INPUT_CLASS}
                disabled={disabled}
            />
        </div>
    );
};

export default FieldInput;
