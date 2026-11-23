/**
 * Folds text for search the same way as `private.fold_vi()` in
 * `supabase/migrations/20261123180000_accent_folding_search.sql` (D40): NFC, lower case, then
 * Vietnamese letters to plain ASCII ("Lập trình" → "lap trinh"). Keep both maps identical.
 */
const FROM =
  'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ'
const TO =
  'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'

const map = new Map([...FROM].map((char, index) => [char, TO[index]]))

export function foldVi(value: string): string {
  return [...value.normalize('NFC').toLowerCase()].map((char) => map.get(char) ?? char).join('')
}
