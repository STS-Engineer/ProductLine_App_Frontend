import { Image as ImageIcon, Paperclip } from 'lucide-react';

// The native file input's own button/label text is rendered by the browser using the OS/browser
// locale (e.g. French "Choisir un fichier"), which can't be overridden via HTML/CSS. Hiding the
// native input and driving it from a label we fully control sidesteps that.
const FileInputButton = ({ id, isImage, onChange, disabled, multiple = true }) => {
    const Icon = isImage ? ImageIcon : Paperclip;
    const labelText = isImage ? 'Choose Photos' : 'Choose Files';

    return (
        <label
            htmlFor={id}
            className={`inline-flex items-center gap-2 px-4 py-2 w-fit rounded-lg border border-[#C7C7C7] bg-[#EAF4FA] text-[#0A4B78] text-sm font-semibold transition-colors duration-150 ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#dcecf7]'
            }`}
        >
            <Icon className="w-4 h-4" />
            {labelText}
            <input
                id={id}
                type="file"
                multiple={multiple}
                accept={isImage ? 'image/*' : '*/*'}
                onChange={onChange}
                disabled={disabled}
                className="sr-only"
            />
        </label>
    );
};

export default FileInputButton;
