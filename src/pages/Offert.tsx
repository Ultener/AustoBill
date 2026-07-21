import LegalPageLayout, { LegalSection, legalP, legalPMuted } from '../components/LegalPageLayout';

export default function Offert() {
  return (
    <LegalPageLayout title="Публичная оферта" updated="18 февраля 2026 г." current="offert">
      <LegalSection title="1. Термины и определения">
        <p style={legalP}>1.1. В настоящей Оферте, если контекст не требует иного, нижеприведенные термины имеют следующие значения:</p>
        <p style={legalPMuted}><strong>«Акцепт»</strong> — полное и безоговорочное принятие Пользователем условий Оферты путем регистрации на Сайте и/или оплаты Услуг.</p>
        <p style={legalPMuted}><strong>«Исполнитель»</strong> — Индивидуальный предприниматель / Юридическое лицо (наименование), действующий на основании законодательства РФ.</p>
        <p style={legalPMuted}><strong>«Заказчик»</strong> — лицо, осуществившее Акцепт Оферты.</p>
        <p style={legalPMuted}><strong>«Сайт»</strong> — интернет-сайт https://austocloud.fun.</p>
        <p style={legalPMuted}><strong>«Услуги»</strong> — услуги по предоставлению виртуальных серверов (VPS/VDS), описанные на Сайте.</p>
      </LegalSection>

      <LegalSection title="2. Предмет Оферты">
        <p style={legalP}>2.1. Исполнитель обязуется предоставить Заказчику услуги по аренде виртуальных серверов (VPS/VDS), а Заказчик обязуется оплатить эти услуги.</p>
        <p style={legalP}>2.2. Наименование, количество, стоимость, сроки и иные параметры Услуг указываются на Сайте в соответствующих разделах.</p>
      </LegalSection>

      <LegalSection title="3. Порядок заключения договора">
        <p style={legalP}>3.1. Акцепт Оферты осуществляется путем регистрации на Сайте и/или оплаты Услуг.</p>
        <p style={legalP}>3.2. Договор считается заключенным с момента Акцепта Оферты.</p>
      </LegalSection>

      <LegalSection title="4. Права и обязанности сторон">
        <p style={legalP}>4.1. Исполнитель обязуется предоставлять Услуги в соответствии с выбранным тарифным планом.</p>
        <p style={legalP}>4.2. Заказчик обязуется своевременно оплачивать Услуги и соблюдать правила использования.</p>
      </LegalSection>

      <LegalSection title="5. Ответственность сторон">
        <p style={legalP}>5.1. Исполнитель не несет ответственности за перерывы в работе, вызванные проведением профилактических работ или техническими сбоями.</p>
        <p style={legalP}>5.2. Заказчик несет ответственность за сохранность своих учетных данных и за все действия, совершенные с их использованием.</p>
      </LegalSection>

      <LegalSection title="6. Срок действия Оферты">
        <p style={legalP}>6.1. Оферта действует бессрочно до момента ее отзыва Исполнителем.</p>
      </LegalSection>

      <LegalSection title="7. Контактная информация">
        <p style={{ ...legalP, marginBottom: 8 }}><strong>Email:</strong> ultener@gmail.com</p>
        <p style={{ ...legalP, marginBottom: 8 }}><strong>Discord:</strong> discord.gg/v94GUautyH</p>
        <p style={{ ...legalP, marginBottom: 8 }}><strong>Форма обратной связи:</strong> в тикетах</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
