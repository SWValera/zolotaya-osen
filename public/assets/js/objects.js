// Единственный источник данных объектов. Координаты — пиксели исходного генплана 1084 × 1280.
export const mapConfig = {
  width: 1084,
  height: 1280,
  image: "./assets/images/masterplan.webp",
};
export const contact = { phone: "+77763055000", email: "", telegram: "" };
export const statuses = {
  unconfirmed: {
    label: "Готовность уточняется",
    note: "Статус объекта и возможность посещения уточняются у администрации.",
  },
  available: {
    label: "Доступен",
    note: "Свободные даты необходимо уточнить у администрации.",
  },
  building: {
    label: "Строится",
    note: "Объект готовится к открытию. Дата открытия пока не объявлена.",
  },
  planned: {
    label: "Планируется",
    note: "Объект запланирован. Сроки открытия пока не объявлены.",
  },
  unavailable: {
    label: "Временно недоступен",
    note: "Объект временно не принимает гостей. Срок возобновления работы уточняется.",
  },
  comingSoon: {
    label: "Скоро открытие",
    note: "Объект пока не принимает гостей. Дату открытия уточняйте у администрации.",
  },
};
export const types = {
  house: "Домики",
  bath: "Бани",
  gazebo: "Беседки",
  place: "На территории",
};
const defaults = {
  price: null,
  priceUnit: "сутки",
  capacity: null,
  beds: null,
  amenities: [],
  photos: [],
  status: "unconfirmed",
  opening: null,
};
function object(id, name, type, description, points, extra = {}) {
  return {
    ...defaults,
    id,
    name,
    type,
    description,
    mapAreaId: `area-${id}`,
    points,
    ...extra,
  };
}
export const objects = [
  object(
    "river-1",
    "Домик слева № 7",
    "house",
    "Домик в верхней части левого ряда. Пока не принимает гостей; открытие готовится.",
    "342,185 404,184 428,246 398,261 335,247",
    { status: "comingSoon" },
  ),
  object(
    "river-2",
    "Домик слева № 6",
    "house",
    "Домик в верхней части левого ряда. Пока не принимает гостей; открытие готовится.",
    "336,265 399,263 422,325 393,339 328,325",
    { status: "comingSoon" },
  ),
  object(
    "river-3",
    "Домик слева № 5",
    "house",
    "Домик в левой части территории. Пока не принимает гостей; открытие готовится.",
    "329,347 393,345 418,407 391,420 322,409",
    { status: "comingSoon" },
  ),
  object(
    "river-4",
    "Домик слева № 4",
    "house",
    "Домик в левой части территории. Пока не принимает гостей; открытие готовится.",
    "323,429 391,427 416,490 388,505 316,491",
    { status: "comingSoon" },
  ),
  object(
    "river-5",
    "Домик слева № 3",
    "house",
    "Домик в нижней половине левого ряда. Пока не принимает гостей; открытие готовится.",
    "319,511 386,510 412,575 382,590 309,576",
    { status: "comingSoon" },
  ),
  object(
    "river-6",
    "Домик слева № 2",
    "house",
    "Домик в нижней части левого ряда. Пока не принимает гостей; открытие готовится.",
    "312,597 382,595 407,662 379,679 302,665",
    { status: "comingSoon" },
  ),
  object(
    "river-7",
    "Домик слева № 1",
    "house",
    "Нижний домик слева на плане, ближе к зоне бассейна. Пока не принимает гостей; открытие готовится.",
    "306,686 378,684 404,750 376,768 296,750",
    {
      status: "comingSoon",
      photos: [
        { src: "./assets/images/objects/river/river-shore.jpg?v=20261028", alt: "Песчаный берег реки и зона отдыха у воды" },
      ],
    },
  ),
  object(
    "upper-1",
    "Верхний домик № 1",
    "house",
    "Один из двух домиков в верхней части территории. Описание интерьера и условия проживания появятся после подтверждения.",
    "438,160 480,144 523,159 526,227 478,240 435,224",
    {
      status: "comingSoon",
      photos: [
        { src: "./assets/images/objects/upper-houses/cabin.jpg?v=20261028", alt: "Деревянный домик в окружении деревьев" },
      ],
    },
  ),
  object(
    "upper-2",
    "Верхний домик № 2",
    "house",
    "Второй домик в верхней части территории. На карте можно посмотреть его расположение относительно большого A-frame.",
    "550,162 592,144 634,161 638,229 590,240 546,225",
    { status: "comingSoon" },
  ),
  object(
    "a-frame",
    "Большой A-frame",
    "house",
    "Большой A-frame с панорамным треугольным остеклением и деревянной отделкой. Вместимость — до 20 человек. Стоимость и свободные даты уточняйте у администрации.",
    "744,101 816,276 790,298 681,285 674,266",
    {
      capacity: 20,
      capacityLabel: "До 20 человек",
      status: "available",
      photos: [
        { src: "./assets/images/objects/a-frame/lounge-window.jpg", alt: "Зона отдыха у панорамного окна в большом A-frame" },
        { src: "./assets/images/objects/a-frame/loft-overview.jpg", alt: "Вид с мансарды на большое панорамное окно и гостиную" },
        { src: "./assets/images/objects/a-frame/loft-bedroom.jpg", alt: "Спальная зона на мансарде под треугольным окном" },
        { src: "./assets/images/objects/a-frame/bedroom-tv.jpg", alt: "Комната с телевизором и кроватью в отделке из дерева" },
        { src: "./assets/images/objects/a-frame/bathroom.jpg", alt: "Раковина и круглое зеркало в ванной комнате" },
        { src: "./assets/images/objects/a-frame/main-bedroom.jpg", alt: "Спальня с двуспальной кроватью" },
        { src: "./assets/images/objects/a-frame/mug-by-window.jpg", alt: "Вид из панорамного окна A-frame на деревья" },
        { src: "./assets/images/objects/a-frame/evening-windows.jpg", alt: "Панорамные окна и тёплое освещение A-frame вечером" },
        { src: "./assets/images/objects/a-frame/owner-gallery/dining-room.jpg", alt: "Обеденная зона и лестница на второй уровень A-frame" },
        { src: "./assets/images/objects/a-frame/owner-gallery/living-room.jpg", alt: "Гостиная с панорамными окнами и большим обеденным столом" },
        { src: "./assets/images/objects/a-frame/owner-gallery/bedroom-loft.jpg", alt: "Спальная зона и лестница на мансарде A-frame" },
        { src: "./assets/images/objects/a-frame/owner-gallery/bathroom.jpg", alt: "Ванная комната с ванной и раковиной в деревянном доме" },
        { src: "./assets/images/objects/a-frame/owner-gallery/bedroom.jpg", alt: "Спальня с двуспальной кроватью в деревянном доме" },
        { src: "./assets/images/objects/a-frame/owner-gallery/exterior.jpg", alt: "Большой A-frame снаружи среди деревьев" },
      ],
    },
  ),
  object(
    "bath-1",
    "Баня № 2",
    "bath",
    "Верхняя баня на правой стороне генплана. Готовность и условия посещения уточняются.",
    "721,350 818,350 830,426 812,440 704,432 704,389",
    {
      priceUnit: "час",
    },
  ),
  object(
    "bath-2",
    "Баня № 1",
    "bath",
    "Нижняя баня на правой стороне генплана. Баня работает; свободное время, стоимость и условия посещения уточняйте у администрации.",
    "728,443 823,442 833,511 815,529 707,518 708,482",
    {
      priceUnit: "час",
      capacity: 12,
      capacityLabel: "До 12 человек",
      status: "available",
      photos: [
        { src: "./assets/images/objects/working-bath/lounge.jpg?v=working-bath-1", alt: "Комната отдыха рабочей бани с диваном и столом" },
        { src: "./assets/images/objects/working-bath/lounge-detail.jpg?v=working-bath-1", alt: "Стол и деревянный буфет в комнате отдыха бани" },
        { src: "./assets/images/objects/working-bath/steam-room.jpg?v=working-bath-1", alt: "Парная бани с деревянными полками и печью" },
        { src: "./assets/images/objects/working-bath/steam-room-detail.jpg?v=working-bath-1", alt: "Печь-каменка и полки в парной" },
        { src: "./assets/images/objects/working-bath/shower.jpg?v=working-bath-1", alt: "Душевая комната при бане" },
        { src: "./assets/images/objects/working-bath/bathroom.jpg?v=working-bath-1", alt: "Санузел и раковина в бане" },
      ],
    },
  ),
  object(
    "gazebo-1",
    "Беседка № 3",
    "gazebo",
    "Верхняя беседка, рядом с банями. Вместимость и условия аренды уточняются.",
    "761,528 804,550 802,603 766,621 727,604 725,550",
    { status: "comingSoon" },
  ),
  object(
    "gazebo-2",
    "Беседка № 2",
    "gazebo",
    "Центральная беседка в ряду из трёх. На генплане рядом проходит прогулочная дорожка.",
    "766,622 810,644 807,694 769,714 729,696 728,646",
    { status: "comingSoon" },
  ),
  object(
    "gazebo-3",
    "Беседка № 1",
    "gazebo",
    "Нижняя беседка, ближе к администрации. Условия посещения будут добавлены после подтверждения.",
    "772,719 816,743 810,794 773,812 732,795 730,744",
    {
      status: "comingSoon",
      photos: [
        { src: "./assets/images/objects/gazebo/glazed-gazebo.jpg?v=20261028", alt: "Кирпичная беседка с панорамными окнами" },
      ],
    },
  ),
  object(
    "pool",
    "Бассейн",
    "place",
    "Зона бассейна обозначена в нижней части генплана. Режим работы и условия посещения уточняются.",
    "337,767 417,747 482,765 507,810 587,852 606,905 576,961 507,986 351,971 287,936 281,886 313,845",
  ),
  object(
    "bar",
    "Бар",
    "place",
    "Бар расположен в центре зоны бассейна на генплане. Меню и режим работы пока не опубликованы.",
    "418,822 475,845 471,899 445,921 391,911 368,881 372,851",
  ),
  object(
    "reception",
    "Администрация",
    "place",
    "Фотография здания администрации, предоставленная владельцем. Контактный телефон указан на сайте; адрес и часы работы уточняйте у администрации.",
    "714,849 782,837 840,841 859,918 817,951 710,936",
    {
      photos: [
        { src: "./assets/images/objects/reception/building.jpg", alt: "Здание администрации среди сосен, предоставленное владельцем" },
      ],
    },
  ),
  object(
    "beach",
    "Пляж",
    "place",
    "Прибрежная зона вдоль домиков отмечена на предоставленном генплане. Условия доступа уточняются.",
    "191,339 241,350 201,706 146,701",
  ),
  object(
    "fishing",
    "Место для рыбалки",
    "place",
    "Место для рыбалки отмечено в верхней части берега. Правила и условия посещения уточняются.",
    "119,169 211,170 209,222 119,213",
  ),
  object(
    "parking",
    "Парковка",
    "place",
    "Парковка на генплане находится перед главным входом. Количество мест и условия использования уточняются.",
    "550,1120 911,1126 913,1237 542,1220",
  ),
  object(
    "entrance",
    "Вход",
    "place",
    "Главный вход расположен между парковкой и центральной дорожкой территории.",
    "638,986 701,985 717,1105 625,1105",
  ),
];
