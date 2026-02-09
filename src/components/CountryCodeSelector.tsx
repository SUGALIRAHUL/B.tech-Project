import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { countryPhoneRules, type CountryPhoneRule } from "@/lib/phone-validation";

interface CountryCodeSelectorProps {
  value: string;
  onSelect: (code: string, countryName: string) => void;
  disabled?: boolean;
}

export function CountryCodeSelector({ value, onSelect, disabled }: CountryCodeSelectorProps) {
  const [open, setOpen] = useState(false);

  // Extract country code from value (e.g., "+14155552671" -> "+1")
  const getCurrentCode = () => {
    if (!value || !value.startsWith("+")) return "+1";
    
    // Find the longest matching country code
    const matchingCodes = countryPhoneRules
      .filter(c => value.startsWith(c.code))
      .sort((a, b) => b.code.length - a.code.length);
    
    return matchingCodes[0]?.code || "+1";
  };

  const currentCode = getCurrentCode();
  const currentCountry = countryPhoneRules.find(c => c.code === currentCode);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-[140px] justify-between"
        >
          <span className="flex items-center gap-2">
            <span className="text-lg">{currentCountry?.flag || "🌍"}</span>
            <span>{currentCode}</span>
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 bg-background z-50" align="start">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {countryPhoneRules.map((country) => (
                <CommandItem
                  key={`${country.code}-${country.name}`}
                  value={`${country.name} ${country.code}`}
                  onSelect={() => {
                    onSelect(country.code, country.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentCode === country.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-lg mr-2">{country.flag}</span>
                  <span className="flex-1">{country.name}</span>
                  <span className="text-muted-foreground">{country.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
