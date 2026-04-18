export interface FormField {
  id: string;
  type: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SELECT' | 'FILE' | 'SIGNATURE';
  label: string;
  required: boolean;
  options: string[];
}

export interface FormSchema {
  fields: FormField[];
}
