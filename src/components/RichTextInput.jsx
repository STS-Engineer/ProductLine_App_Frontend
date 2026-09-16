import Editor, { Toolbar, BtnBold, BtnItalic, BtnUnderline, createButton } from 'react-simple-wysiwyg';

const COLOR_SWATCHES = [
    { hex: '#575757', label: 'Ink' },
    { hex: '#0071B8', label: 'Ocean Blue' },
    { hex: '#ED7300', label: 'Accent Orange' },
    { hex: '#2E7D32', label: 'Success Green' },
    { hex: '#C62828', label: 'Danger Red' },
];

// A fixed, small swatch row rather than a full color picker — this is an internal reporting
// tool, not a design app, so the brand palette is the only color vocabulary that makes sense.
const colorButtons = COLOR_SWATCHES.map(({ hex, label }) =>
    createButton(
        label,
        <span
            style={{
                display: 'inline-block', width: 12, height: 12, borderRadius: '9999px',
                backgroundColor: hex, border: '1px solid rgba(0,0,0,0.2)',
            }}
        />,
        () => document.execCommand('foreColor', false, hex)
    )
);

// Toolbar/button styling is scoped via descendant selectors on the library's stable class
// names (rsw-toolbar/rsw-btn) since the package ships no CSS of its own to override.
const EDITOR_WRAPPER_CLASS = `
    rounded-lg border border-[#C7C7C7] focus-within:border-[#0071B8] focus-within:ring-2
    focus-within:ring-[#0071B8] transition-colors duration-150 overflow-hidden bg-white
    [&_.rsw-toolbar]:bg-[#F4F6F8] [&_.rsw-toolbar]:border-b [&_.rsw-toolbar]:border-[#C7C7C7]
    [&_.rsw-toolbar]:flex [&_.rsw-toolbar]:flex-wrap [&_.rsw-toolbar]:p-1 [&_.rsw-toolbar]:gap-0.5
    [&_.rsw-btn]:border-0 [&_.rsw-btn]:bg-transparent [&_.rsw-btn]:px-2 [&_.rsw-btn]:py-1
    [&_.rsw-btn]:rounded [&_.rsw-btn]:text-[#575757] [&_.rsw-btn]:cursor-pointer
    [&_.rsw-btn:hover]:bg-[#EAF4FA] [&_.rsw-btn[data-active="true"]]:bg-[#EAF4FA]
    [&_.rsw-btn[data-active="true"]]:text-[#0071B8]
`;

const RichTextInput = ({
    field, label, isRequired,
    value, onChange, disabled,
    idPrefix = 'field',
    placeholder,
    containerClassName = "relative flex flex-col col-span-full",
}) => {
    const currentValue = value ?? '';
    const inputId = `${idPrefix}-${field}`;

    return (
        <div className={containerClassName}>
            <label htmlFor={inputId} className="text-xs font-medium text-[#575757] mb-1">{label} {isRequired && '*'}</label>
            <div className={EDITOR_WRAPPER_CLASS}>
                <Editor
                    id={inputId}
                    value={currentValue}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={`min-h-[6rem] max-h-96 overflow-y-auto p-3 text-sm outline-none ${disabled ? 'bg-[#F4F6F8] text-[#8A8A8A]' : 'text-[#575757]'}`}
                >
                    <Toolbar>
                        <BtnBold />
                        <BtnItalic />
                        <BtnUnderline />
                        {colorButtons.map((Btn, i) => <Btn key={COLOR_SWATCHES[i].hex} />)}
                    </Toolbar>
                </Editor>
            </div>
        </div>
    );
};

export default RichTextInput;
