export interface GridColumn {
  id: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';
  label: string;
  options?: string[];
}

export interface FormField {
  id: string;
  type: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKLIST' | 'FILE' | 'SIGNATURE' | 'GRID';
  label: string;
  required: boolean;
  options: string[];
  columns?: GridColumn[];
}

export interface FormSchema {
  fields: FormField[];
}
