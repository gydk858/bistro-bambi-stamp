// Keep the stored key stable so old purchases, sizes and rankings stay linked.
export const animalLabel = animal => animal === '猪' ? 'イノシシ' : animal
export const animalKey = animal => animal === 'イノシシ' ? '猪' : animal
export const skinSizeByAnimal = {'熊':0,'猪':1,'イノシシ':1,'鹿':1,'ライオン':1,'コヨーテ':2,'兎':2,'スカンク':2}
