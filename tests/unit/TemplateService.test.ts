import { generateCsvContent, buildTemplateWorkbook } from '@/services/bulk-upload/TemplateService';
import { TEMPLATE_COLUMNS } from '@/types/BulkUpload';

describe('TemplateService', () => {
  const categories = [{ name: 'Vegetables' }, { name: 'Dairy' }];

  it('generates CSV with all template columns', () => {
    const csv = generateCsvContent(categories);
    for (const col of TEMPLATE_COLUMNS) {
      expect(csv).toContain(col.header);
    }
  });

  it('includes category names in workbook', () => {
    const workbook = buildTemplateWorkbook(categories);
    expect(workbook.SheetNames).toContain('Categories');
    expect(workbook.SheetNames).toContain('Products');
    expect(workbook.SheetNames).toContain('Instructions');
    expect(workbook.SheetNames).toContain('Validation');
  });

  it('includes sample data row', () => {
    const workbook = buildTemplateWorkbook(categories);
    const sheet = workbook.Sheets.Products;
    const csv = require('xlsx').utils.sheet_to_csv(sheet);
    expect(csv).toContain('Fresh Tomato');
    expect(csv).toContain('Vegetables');
  });
});
