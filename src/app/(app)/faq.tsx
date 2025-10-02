import React from 'react';
import { ScrollView } from 'react-native';

import { FocusAwareStatusBar, Text, View } from '@/components/ui';
import { credentialStorage } from '@/lib';

const FAQItem = ({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) => (
  <View className="mb-6">
    <Text className="mb-2 text-xl font-semibold">{question}</Text>
    <Text className="text-base leading-6 text-gray-700 dark:text-gray-300">
      {answer}
    </Text>
  </View>
);

const faqData = [
  {
    question: 'What is Cardless ID?',
    answer:
      'Cardless ID is a decentralized identity credential system that allows you to verify your age for adult content websites without sharing personal information.',
  },
  {
    question: 'How does it work?',
    answer:
      'After verification on cardlessid.org, you receive a digital credential stored in your wallet. Websites can verify your age via QR code, and the wallet responds with true/false along with your wallet address—no other personal data is shared.',
  },
  {
    question: 'Is my data private?',
    answer:
      'Yes! Zero information about you is stored in any database. Your credential is on your phone and confirms age eligibility without revealing identity.',
  },

  {
    question: 'How do I get verified?',
    answer:
      'Visit cardlessid.org and complete the verification process using a third-party identity verification service. Once verified, your credential will be issued to this app.',
  },
  {
    question: 'What websites support Cardless ID?',
    answer:
      'Support is currently being rolled out. Check back for updates on participating websites that accept Cardless ID for age verification.',
  },
];

export default function FAQ() {
  const [isVerified, setIsVerified] = React.useState(false);

  React.useEffect(() => {
    const credential = credentialStorage.getCredential();
    setIsVerified(credential !== null);
  }, []);

  const faqDataWithVerification = React.useMemo(() => {
    const getVerificationAnswer = () => {
      if (isVerified) {
        return 'You are already verified.';
      }
      return 'Tap the Cardless ID icon in the lower left corner.';
    };

    return faqData.map((item) => {
      if (item.question === 'How do I get verified?') {
        return {
          ...item,
          answer: getVerificationAnswer(),
        };
      }
      return item;
    });
  }, [isVerified]);

  return (
    <View className="flex-1">
      <FocusAwareStatusBar />
      <ScrollView className="flex-1 p-4">
        <Text className="mb-6 text-3xl font-bold">
          Frequently Asked Questions
        </Text>
        {faqDataWithVerification.map((item, index) => (
          <FAQItem key={index} question={item.question} answer={item.answer} />
        ))}
      </ScrollView>
    </View>
  );
}
