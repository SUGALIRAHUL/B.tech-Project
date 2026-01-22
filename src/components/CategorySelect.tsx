import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CategorySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  categories: string[];
  placeholder?: string;
  label: string;
  required?: boolean;
}

export function CategorySelect({
  value,
  onValueChange,
  categories,
  placeholder = "Select an option",
  label,
  required = false,
}: CategorySelectProps) {
  const [isOther, setIsOther] = useState(false);
  const [customValue, setCustomValue] = useState("");

  // Check if current value is in predefined categories
  const isCustomValue = value && !categories.includes(value) && value !== "other";

  const handleSelectChange = (selected: string) => {
    if (selected === "other") {
      setIsOther(true);
      setCustomValue("");
      onValueChange("");
    } else {
      setIsOther(false);
      setCustomValue("");
      onValueChange(selected);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setCustomValue(newValue);
    onValueChange(newValue);
  };

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {!isOther && !isCustomValue ? (
        <Select value={value} onValueChange={handleSelectChange}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="bg-background border z-50">
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
            <SelectItem value="other" className="text-primary font-medium">
              Others (Custom)
            </SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <div className="space-y-2">
          <Input
            value={isCustomValue ? value : customValue}
            onChange={handleCustomChange}
            placeholder="Enter custom name"
            required={required}
          />
          <button
            type="button"
            onClick={() => {
              setIsOther(false);
              setCustomValue("");
              onValueChange("");
            }}
            className="text-xs text-primary hover:underline"
          >
            ← Back to list
          </button>
        </div>
      )}
    </div>
  );
}

// Predefined categories for different modules
export const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Transportation",
  "Fuel",
  "Utilities",
  "Rent",
  "Healthcare",
  "Insurance",
  "Entertainment",
  "Shopping",
  "Education",
  "Personal Care",
  "Travel",
  "Subscriptions",
  "EMI/Loans",
  "Home Maintenance",
];

export const INCOME_SOURCES = [
  "Salary",
  "Freelance",
  "Business",
  "Investments",
  "Dividends",
  "Rental Income",
  "Interest",
  "Pension",
  "Bonus",
  "Commission",
  "Side Hustle",
  "Gifts",
  "Tax Refund",
];

export const BUDGET_CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Transportation",
  "Fuel",
  "Utilities",
  "Rent",
  "Healthcare",
  "Insurance",
  "Entertainment",
  "Shopping",
  "Education",
  "Personal Care",
  "Travel",
  "Subscriptions",
  "EMI/Loans",
  "Savings",
  "Emergency Fund",
  "Investments",
];

export const GOAL_TYPES = [
  "Emergency Fund",
  "Vacation",
  "New Car",
  "Home Down Payment",
  "Wedding",
  "Education",
  "Retirement",
  "Debt Payoff",
  "Gadgets/Electronics",
  "Home Renovation",
  "Investment",
  "Medical",
  "Child Education",
  "Business",
];
