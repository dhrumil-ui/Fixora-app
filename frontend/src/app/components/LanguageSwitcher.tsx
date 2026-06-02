import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { Globe, Check } from "lucide-react";

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ||
    SUPPORTED_LANGUAGES[0];

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={t("language.select")}
        >
          <Globe size={18} />
          <span className="text-sm font-medium">
            {currentLang.flag} {currentLang.name}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[180px] bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-50"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className="flex items-center justify-between px-3 py-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 outline-none text-sm"
          >
            <span>
              {lang.flag} {lang.name}
            </span>
            {i18n.language === lang.code && <Check size={16} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
