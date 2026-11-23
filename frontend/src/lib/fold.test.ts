import { foldVi } from './fold'

describe('foldVi', () => {
  it('drops case and Vietnamese accents', () => {
    expect(foldVi('Học LẬP TRÌNH ở Đà Nẵng')).toBe('hoc lap trinh o da nang')
  })

  it('folds decomposed input like composed input', () => {
    expect(foldVi('Lập'.normalize('NFD'))).toBe('lap')
  })

  // supabase/tests/database/functions_test.sql checks private.fold_vi() on the same string.
  it('folds every Vietnamese letter like the database', () => {
    expect(
      foldVi(
        'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ',
      ),
    ).toBe(
      'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd',
    )
  })
})
